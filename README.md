# TheWinterArc V2

TheWinterArc is a local-first desktop analytics workstation. From the directory containing `serve.sh`, install the Python dependencies with `python3 -m pip install -r requirements.txt`, run `./serve.sh`, and open <http://127.0.0.1:8765/>. Nonempty correlation analyses also require `Rscript` on `PATH`.

See [implementation status](docs/IMPLEMENTATION_STATUS.md) for verified features and acquisition gaps. [AGENTS.md](AGENTS.md) and [MASTER.md](MASTER.md) describe the development workflow.

For the standalone desktop archive, see [Health Connect over USB](docs/HEALTHCONNECT_USB.md).
