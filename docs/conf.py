# Configuration file for the Sphinx documentation builder.
# https://www.sphinx-doc.org/en/master/usage/configuration.html

import json
from datetime import date
from pathlib import Path

# -- Project information -----------------------------------------------------

project = "hed-typescript"
copyright = f"2017-{date.today().year}, HED Working Group"
author = "HED Working Group"

# The package version comes from package.json, so the two never disagree.
_package = json.loads((Path(__file__).resolve().parent.parent / "package.json").read_text(encoding="utf-8"))
version = _package["version"]
release = version

# -- General configuration ---------------------------------------------------

extensions = [
    "myst_parser",
    "sphinx_copybutton",
]

myst_heading_anchors = 4
myst_enable_extensions = [
    "colon_fence",
    "deflist",
    "linkify",
]

templates_path = ["_templates"]
source_suffix = {".rst": "restructuredtext", ".md": "markdown"}
master_doc = "index"

# _build/ is the output (TypeDoc writes _build/html/api/); api_readme.md is the TypeDoc front page.
exclude_patterns = ["_build", "_templates", "api_readme.md", "Thumbs.db", ".DS_Store"]

# -- Options for HTML output -------------------------------------------------

pygments_style = "sphinx"
pygments_dark_style = "monokai"

html_theme = "furo"
html_title = "hed-typescript"
html_logo = "_static/images/croppedWideLogo.png"

html_theme_options = {
    "sidebar_hide_name": False,
    "light_css_variables": {
        "color-brand-primary": "#0969da",
        "color-brand-content": "#0969da",
    },
    "dark_css_variables": {
        "color-brand-primary": "#58a6ff",
        "color-brand-content": "#58a6ff",
    },
    "source_repository": "https://github.com/hed-standard/hed-typescript/",
    "source_branch": "main",
    "source_directory": "docs/",
}

html_sidebars = {
    "**": [
        "sidebar/brand.html",
        "sidebar/search.html",
        "sidebar/scroll-start.html",
        "sidebar/navigation.html",
        "quicklinks.html",
        "sidebar/scroll-end.html",
    ]
}

html_static_path = ["_static"]
html_css_files = ["custom.css"]
html_js_files = ["gh_icon_fix.js"]
