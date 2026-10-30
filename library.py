"""Real library writes; one metadata file keeps colors and stable graph IDs."""
import copy
from datetime import date
import json
import os
from pathlib import Path
import re
import tempfile
import threading

from build import METADATA, build_graph, read_metadata


class LibraryError(ValueError):
    def __init__(self, message, status=400):
        self.status = status
        super().__init__(message)


def validate_name(name):
    if (not isinstance(name, str) or not name or name in ('.', '..') or
            name.endswith((' ', '.')) or len(name.encode('utf-16-le', errors='surrogatepass')) > 510 or
            re.search(r'[<>:"/\\|?*\x00-\x1f\ud800-\udfff]', name) or
            re.fullmatch(r'(?i)(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])', name.split('.')[0].rstrip()) or
            name.casefold().startswith('.cosmos-')):
        raise LibraryError('Use a valid filename: no reserved names, slashes, control characters, or trailing spaces/dots.')
    return name


class Library:
    def __init__(self, folder):
        self.root = Path(folder).resolve(strict=True)
        if not self.root.is_dir():
            raise LibraryError('Connect a library directory before adding items.')
        # ponytail: serialize writes for this personal library; use per-folder locks if throughput matters.
        self.lock = threading.RLock()
        self.metadata = read_metadata(self.root)
        self.graph = build_graph(self.root, self.metadata)
        metadata = self._metadata(self.graph)
        if metadata != self.metadata or not (self.root / METADATA).exists():
            self._save(metadata)
        self.metadata = metadata

    def _metadata(self, graph):
        metadata = copy.deepcopy(self.metadata)
        metadata['colors'].update({c['id']: c['color'] for c in graph['constellations']})
        metadata['ids'].update({n['path']: n['id'] for n in graph['nodes']})
        return metadata

    def _save(self, metadata):
        handle, name = tempfile.mkstemp(prefix='.cosmos-metadata-', dir=self.root)
        temporary = Path(name)
        try:
            with os.fdopen(handle, 'w', encoding='utf-8') as stream:
                json.dump(metadata, stream, ensure_ascii=True, indent=2)
                stream.flush()
                os.fsync(stream.fileno())
            temporary.replace(self.root / METADATA)
        finally:
            temporary.unlink(missing_ok=True)

    def _directory(self, identifier):
        if identifier is None:
            return self.root
        if not isinstance(identifier, str) or not any(c['id'] == identifier for c in self.graph['constellations']):
            raise LibraryError('Choose an existing constellation.')
        target = self.root
        if identifier != '.':
            for part in identifier.split('/'):
                validate_name(part)
                target /= part
                if target.is_symlink() or target.is_junction():
                    raise LibraryError('Linked directories cannot be used for library writes.')
        if not target.resolve(strict=True).is_relative_to(self.root) or not target.is_dir():
            raise LibraryError('The target must be inside the connected library.')
        return target

    @staticmethod
    def _duplicates(folder, names):
        existing = {p.name.casefold() for p in folder.iterdir()}
        seen = set()
        for name in names:
            validate_name(name)
            folded = name.casefold()
            if folded in existing or folded in seen:
                raise LibraryError(f'"{name}" already exists or is selected twice. Rename it or choose another constellation; nothing was replaced.', 409)
            seen.add(folded)

    def _commit(self, metadata):
        graph = build_graph(self.root, metadata)
        metadata['colors'].update({c['id']: c['color'] for c in graph['constellations']})
        metadata['ids'].update({n['path']: n['id'] for n in graph['nodes']})
        self._save(metadata)
        self.metadata, self.graph = metadata, graph
        return graph

    def create(self, parent, name, color):
        if not isinstance(color, str) or not re.fullmatch(r'#[0-9A-Fa-f]{6}', color):
            raise LibraryError('Choose a valid constellation color.')
        with self.lock:
            folder = self._directory(parent)
            self._duplicates(folder, [name])
            target = folder / name
            target.mkdir()  # Exclusive: never reuse a folder created concurrently.
            try:
                metadata = copy.deepcopy(self.metadata)
                metadata['colors'][target.relative_to(self.root).as_posix()] = color
                return self._commit(metadata)
            except Exception:
                target.rmdir()  # Only removes our empty folder, never pre-existing contents.
                raise

    def add(self, constellation, files):
        if constellation is None or not files:
            raise LibraryError('Choose a constellation and at least one file.')
        with self.lock:
            folder = self._directory(constellation)
            self._duplicates(folder, [name for name, _ in files])
            created = []
            try:
                for name, content in files:
                    target = folder / name
                    with target.open('xb') as stream:
                        created.append(target)
                        stream.write(content)
                        stream.flush()
                        os.fsync(stream.fileno())
                return self._commit(copy.deepcopy(self.metadata))
            except Exception:
                for target in created:
                    target.unlink(missing_ok=True)
                raise

    def remember(self, text, related=None):
        title = ' '.join(re.findall(r'[^\W_]+', text)[:7])[:80] or 'Captured thought'
        title = title[0].upper() + title[1:]
        with self.lock:
            folder = self.root / 'captures'
            if folder.is_symlink() or folder.is_junction() or not folder.resolve().is_relative_to(self.root):
                raise LibraryError('The captures folder must be a real folder inside your notes directory.')
            created_folder, created_file = False, None
            try:
                if not folder.exists():
                    folder.mkdir()
                    created_folder = True
                folder = folder.resolve(strict=True)
                existing = {p.name.casefold() for p in folder.iterdir()}
                stem = 'Note ' + title if re.fullmatch(r'(?i)(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])', title) else title
                name, suffix = stem + '.md', 1
                while name.casefold() in existing:
                    suffix += 1
                    name = f'{stem} ({suffix}).md'
                validate_name(name)
                body = f'# {title}\n\nDate: {date.today().isoformat()}\n\n{text}\n'
                if related and not re.search(r'[\[\]|#\r\n]', related['path']):
                    body += '\nRelated: [[' + Path(related['path']).with_suffix('').as_posix() + ']]\n'
                target = folder / name
                with target.open('xb') as stream:
                    created_file = target
                    stream.write(body.encode('utf-8'))
                    stream.flush()
                    os.fsync(stream.fileno())
                graph = self._commit(copy.deepcopy(self.metadata))
                node = next(n for n in graph['nodes'] if n['path'] == target.relative_to(self.root).as_posix())
                return dict(graph=graph, nodeId=node['id'], relatedId=related['id'] if related else None,
                            answer='Remembered — a new star in your galaxy, ready when you need it.')
            except Exception:
                if created_file:
                    created_file.unlink(missing_ok=True)
                if created_folder:
                    folder.rmdir()
                raise
