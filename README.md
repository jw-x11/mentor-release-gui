# Mentor workbench

A local web interface for the [Mentor](https://github.com/hardekbc/mentor-release/tree/master) command-line tool. Mentor checks and explores formal-language specifications: DFA, NFA, regular expressions, context-free grammars, pushdown automata, Turing machines, and hierarchical Turing machines.

The page is plain HTML, CSS, and JavaScript. Flask serves that page and runs the Mentor CLI.

## Run

Python 3 and the bundled Linux executable in `mentor_app/` are required. The executable is the x86 Linux build from the Mentor release.

```bash
python3 -m pip install -r requirements.txt
python3 app.py
```

Open http://127.0.0.1:8765.

`MENTOR_HOST` and `MENTOR_PORT` change the address. The default is `127.0.0.1:8765`.

## Use

Pick a specification type, write one or load an example, then run a Mentor command. The file field names the specification used in the command preview and when you save. Graph diagrams for DFA, NFA, and PDA are drawn in the browser with [Viz.js](https://github.com/mdaines/viz-js). If Graphviz `dot` is installed, the server can render the diagram as well.

The Guide button opens the Mentor user guide.

## Layout

| Path | Contents |
| --- | --- |
| `app.py` | Flask server and Mentor command runner |
| `static/` | Page, styles, and client script |
| `examples/` | Sample specifications and the user guide |
| `mentor_app/` | Mentor launcher, `bin/mentor-cli`, and shared libraries |

## Credit

The Mentor CLI is from [hardekbc/mentor-release](https://github.com/hardekbc/mentor-release/tree/master), by Prof. Ben Hardekopf and the UC Santa Barbara Programming Languages Lab.
