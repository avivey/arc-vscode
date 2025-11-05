# Arcanist: A VSCode Extension

An extension for getting some of [Phorge/Arcanist](https://we.phorge.it/)
features integrated with Visual Studio Code.


## Features

* ⭐NEW⭐ Preview Remarkup in your editor\
![preview remarkup](images/remarkup.png)
* Show arc-lint notes in editor \
![arc lint](images/lint.png)
* Open file in Diffusion \
![arc browse](images/browse.png)
* Show hovercards for Phorge object mentions \
![hovercard](images/hovercard.png)
* Recognize Arcanist files as JSON

## Requirements

This extension requires Arcanist to be installed and configured for the
directory you work in; `arc` and all your linters should be in the PATH for vscode
to be able to run them. \
Only reasonably recent versions of Arcanist are supported.


## Known Issues

* Lints do not update as you type - you must save a file for changes to take
  effect. Lints also might drift when making large changes.
* Most lints only show up as 3-characters-squiggle, which is hard to see.\
  We suggest users install the `usernamehw.errorlens` extension.
* When working with multiple Phorge servers, the hovercard cache may get confused.

## Disclaimers

This extension is not affiliated with, nor is it supported by,
[Phacility](https://phacility.com/), the Phabricator project or the Phorge project.
All trademarks are property of their respective owners.
