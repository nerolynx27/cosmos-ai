<p align="center">
  <img src="viewer/cosmos-logo.svg" width="120" alt="Cosmos AI logo">
</p>

<h1 align="center">Cosmos AI</h1>
<p align="center">Your files, connected as a galaxy. Your AI, running locally.</p>

Cosmos turns your files into **stars** and your folders into **constellations**. Explore their connections in a 3D workspace, then ask a local AI questions grounded in your notes.

Built with Python, plain JavaScript, and llama.cpp. No frontend build step or cloud AI key is required.

## Features

- **Explore your galaxy.** Browse a 3D graph, search your library, and open individual stars.
- **Build your library.** Create constellations, import files, and save new Markdown memories.
- **Ask with sources.** Get answers grounded in your Markdown and text notes, with links to supporting stars.
- **Control your model.** Start, switch, reload, and stop local models from the interface.
- **Use voice and screen questions.** Browser voice controls are available where supported; screen questions also require Pillow and a vision-capable model.

Your library starts empty. Add only the files you want Cosmos to use.

## Requirements

| Requirement | Purpose |
| --- | --- |
| Python **3.12 or newer** | Runs the application and indexes your library |
| A browser with WebGL | Displays the 3D workspace |
| llama.cpp with `llama-server` | Runs local AI models; install separately |
| Sufficient RAM/VRAM and disk space | Loads your chosen model and stores its weights |
| Internet access for external downloads | Loads pinned viewer scripts from jsDelivr and downloads models when needed |

Library browsing, imports, and memories work without loading a model. AI answers require a running model.

## Installation

1. Download or clone this repository and open a terminal in its root folder.
2. Check your Python version:

   ```powershell
   python --version
   ```

   Use Python 3.12 or newer. If Windows selects an older installation, use `py -3.12` in place of `python` in the commands below, or correct your PATH.

3. Install llama.cpp separately. Make `llama-server` available on PATH, or supply its executable path when starting Cosmos.
4. For screen questions, install the optional dependency:

   ```powershell
   python -m pip install -r requirements-screen.txt
   ```

Core browsing and text chat use Python's standard library; no pip installation is required for those features.

## Run Cosmos

From the repository root:

```powershell
python build.py
python server.py
```

Open **http://127.0.0.1:4700** in your browser.

On Windows, you can also use the included launcher:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

Cosmos opens with an empty library. Create a constellation and import your files, then select a model and choose **Start model** when you want to chat. The first model load may download weights and take time.

Press **Ctrl+C** in the server terminal to stop Cosmos and its owned model process.

### Connect an existing library

Keep private files outside the source repository:

```powershell
python server.py --library "C:\path\to\your\library"
```

Or use the Windows launcher:

```powershell
.\start.ps1 -Notes "C:\path\to\your\library"
```

Stars are real files and constellations are real folders. Imports and saved memories write into the connected library. Cosmos creates a hidden `.cosmos-library.json` metadata file there to preserve colors and identifiers.

Markdown and plain text supply AI context. Other file types appear in the library, but their contents are not parsed for answers. Graph connections come from note titles and wikilinks.

## Model setup

Edit `config.json` while Cosmos is stopped, then restart it. The included profiles preserve the application's current Qwen and MiniCPM choices.

- `active_profile` selects the initial profile; it does not automatically start a model.
- Each profile's `model_source` identifies the download requested from llama.cpp.
- `args` contains that profile's llama.cpp launch arguments.
- `base_url` must remain `http://127.0.0.1:8080/v1`.
- Model arguments must bind to `127.0.0.1` on port `8080`.

To use an executable outside PATH:

```powershell
python server.py --llama-server "C:\path\to\llama-server.exe"
```

To use an existing GGUF file, replace a profile's `model_source` with `model_path` pointing to that file. Keep the profile's `label` and required host/port arguments. Do not set both `model_source` and `model_path`.

Model availability, memory needs, and vision support depend on the model and your llama.cpp installation. The shipped large-model profiles can require substantial memory. Model weights are downloaded separately and are not included in this repository.

## Privacy and practical limits

Cosmos serves the interface on loopback and sends inference requests to the local model server. It keeps your library on your computer.

The interface loads rendering scripts from jsDelivr. Model downloads use external services, and browser dictation may use an online speech service. These features mean the default setup is not fully offline.

Screen questions use a browser-shared screen frame. A compatible vision model and Pillow are required; a text-only model cannot answer screen questions.

The included launcher targets Windows. Fresh-machine macOS and Linux support has not been verified.

Generated graph exports, notes, caches, and model files are local runtime data. Do not commit private library content or generated exports. This source package intentionally includes no sample notes, screenshots, or model weights.

## License

[MIT](LICENSE) — Copyright (c) 2026 Mu'az bin Ma'mun.

Third-party scripts and model weights retain their own licenses.
