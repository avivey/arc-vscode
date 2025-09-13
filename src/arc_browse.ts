import * as vscode from 'vscode';
import * as path from 'path';

import { arc, ExecResult } from './exec_arc';

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

    function handleExecResult(value: ExecResult) {
        // In the happy case, arc-browse outputs nothing.
        if (!value.stdout) {
            return;
        }
        // If it does print something, it's an error message.
        vscode.window.showErrorMessage('arc-browse error:' + value.stdout);
    }

    arc(['browse', '--types', 'path', '--', path.basename(filename)],
        handleExecResult, path.dirname(filename));
}
