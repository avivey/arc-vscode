import * as vscode from 'vscode';
import * as execa from 'execa';
import * as path from 'path';

var LOG: vscode.OutputChannel;

export function setup(log: vscode.OutputChannel) {
    LOG = log;
}

export function browseFile(resource: vscode.Uri | undefined) {
    if (!resource) {
        if (!vscode.window.activeTextEditor) { return; }

        const document = vscode.window.activeTextEditor.document;
        resource = document.uri;
    }

    if (resource.scheme !== "file") { return; }

    const filename = resource.path;

    function handleExecResult(value: execa.ExecaReturnValue<string>) {
        // In the happy case, arc-browse outputs nothing.
        if (!value.stdout) {
            return;
        }
        // If it does print something, it's an error message.
        vscode.window.showErrorMessage('arc-browse error:' + value.stdout);
    }

    execa(
        'arc', ['browse', '--types', 'path', '--', path.basename(filename)],
        { cwd: path.dirname(filename) },
    ).then(handleExecResult, handleExecResult);
}
