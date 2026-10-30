"""Index a local library with Python's standard library: python build.py [library-folder]."""
import argparse
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
METADATA = '.cosmos-library.json'
LEGACY_COLORS = ['#dfb37e', '#9eb4ff', '#67d7b3', '#6fc6ee', '#d496dc', '#ed927f']


def read_metadata(folder):
    path = folder / METADATA
    if not path.exists():
        return dict(colors={}, ids={})
    if path.is_symlink() or not path.resolve().is_relative_to(folder):
        raise ValueError('Library metadata must stay inside the library directory.')
    metadata = json.loads(path.read_text(encoding='utf-8'))
    colors, ids = metadata['colors'], metadata['ids']
    if (not isinstance(colors, dict) or not isinstance(ids, dict) or
            any(not isinstance(v, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', v) for v in colors.values()) or
            any(type(v) is not int or v < 0 for v in ids.values()) or len(set(ids.values())) != len(ids)):
        raise ValueError('Invalid library metadata. Restore it before writing to the library.')
    return metadata


def library_entries(folder):
    directories, files = [], []
    for current, names, filenames in os.walk(folder, followlinks=False):
        parent = Path(current)
        names[:] = [name for name in names if not name.casefold().startswith('.cosmos-')
                    and not (parent / name).is_symlink() and not (parent / name).is_junction()
                    and (parent / name).resolve().is_relative_to(folder)]
        directories.extend(parent / name for name in names)
        files.extend(parent / name for name in filenames if not name.casefold().startswith('.cosmos-')
                     and not (parent / name).is_symlink() and (parent / name).resolve().is_relative_to(folder))
    return directories, files


def normalize(value):
    return re.sub(r'\s+', ' ', value.replace('_', ' ').replace('-', ' ')).strip().casefold()


def build_graph(folder, metadata=None):
    folder = Path(folder).resolve(strict=True)
    if not folder.is_dir():
        raise ValueError('The notes path must be a folder.')
    metadata = read_metadata(folder) if metadata is None else metadata
    directories, files = library_entries(folder)
    # Keep the original Markdown ordering on first migration; new files receive unused IDs.
    files.sort(key=lambda p: (p.suffix.lower() != '.md', p.relative_to(folder).as_posix().casefold()))
    ids = dict(metadata['ids'])
    next_id = max(ids.values(), default=-1) + 1
    for path in files:
        relative = path.relative_to(folder).as_posix()
        if relative not in ids:
            ids[relative] = next_id
            next_id += 1
    files.sort(key=lambda p: ids[p.relative_to(folder).as_posix()])
    legacy_groups = sorted({p.parent.name for p in files if p.suffix.lower() == '.md'})
    legacy_colors = {name: LEGACY_COLORS[i % len(LEGACY_COLORS)] for i, name in enumerate(legacy_groups)}
    if any(p.parent == folder for p in files):
        directories.append(folder)
    constellations = []
    for path in sorted(directories, key=lambda p: p.relative_to(folder).as_posix().casefold()):
        relative = path.relative_to(folder).as_posix()
        parent_id = None if path == folder or path.parent == folder else path.parent.relative_to(folder).as_posix()
        color = metadata['colors'].get(relative, legacy_colors.get(path.name, '#E3B478'))
        constellations.append(dict(id=relative, parentId=parent_id, name=path.name, color=color))
    nodes, bodies, refs, keys = [], [], [], []
    for path in files:
        if not path.resolve().is_relative_to(folder):
            continue
        body = ''
        if path.suffix.lower() in ('.md', '.txt'):
            with path.open(encoding='utf-8-sig', errors='replace') as stream:
                body = stream.read(2_000_000)
        label = (re.sub(r'[_-]+', ' ', path.stem).strip() or path.stem) if path.suffix.lower() == '.md' else path.name
        excerpt = re.sub(r'\s+', ' ', body).strip()
        relative = path.relative_to(folder).as_posix()
        nodes.append(dict(id=ids[relative], label=label, group=path.parent.name,
                          constellationId=path.parent.relative_to(folder).as_posix(), name=path.name, path=relative,
                          content=body[:5000],
                          excerpt=excerpt[:700] + ('…' if len(excerpt) > 700 else '')))
        bodies.append(normalize(body))
        refs.append({normalize(m.split('|')[0].split('#')[0].removesuffix('.md'))
                     for m in re.findall(r'\[\[([^\]]+)\]\]', body) if m.split('|')[0].split('#')[0]})
        keys.append({normalize(path.stem), normalize(path.relative_to(folder).with_suffix('').as_posix())})
    # ponytail: pairwise matching suits personal vaults; inverted indexes if very large vaults get slow.
    targets = [{j for j, keyset in enumerate(keys) if references & keyset} for references in refs]
    links = []
    for i, node in enumerate(nodes):
        for j in range(i + 1, len(nodes)):
            title_i, title_j = normalize(node['label']), normalize(nodes[j]['label'])
            mentioned = (re.search(r'(?<!\w)' + re.escape(title_i) + r'(?!\w)', bodies[j]) or
                         re.search(r'(?<!\w)' + re.escape(title_j) + r'(?!\w)', bodies[i]))
            if mentioned or refs[i] & refs[j] or targets[i] & targets[j] or j in targets[i] or i in targets[j]:
                links.append(dict(source=node['id'], target=nodes[j]['id']))
    return dict(nodes=nodes, links=links, constellations=constellations, libraryPath=str(folder))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('notes', nargs='?', type=Path)
    args = parser.parse_args()
    try:
        from library import Library
        folder = args.notes if args.notes is not None else ROOT / 'notes'
        if args.notes is None:
            folder.mkdir(exist_ok=True)
        graph = Library(folder).graph
    except (OSError, ValueError) as exc:
        parser.exit(1, f'Cannot index notes: {exc}\n')
    output = ROOT / 'viewer' / 'graph-data.js'
    output.parent.mkdir(exist_ok=True)
    temporary = output.with_suffix('.tmp')
    temporary.write_text('const GRAPH = ' + json.dumps(graph, ensure_ascii=True) + ';\n', encoding='utf-8')
    temporary.replace(output)
    print(f'Indexed {len(graph["nodes"])} stars and {len(graph["links"])} connections -> {output}')
    if not graph['nodes']:
        print('No files found. The viewer will show an empty library.')


if __name__ == '__main__':
    main()
