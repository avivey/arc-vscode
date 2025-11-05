import * as vscode from 'vscode';
import * as path from 'path';

import { ArcanistHandle } from './arcanist_types';
import { callConduit, ConduitResponse } from './exec_arc';

const MONOGRAM_REGEX = /\b[DFHLPTU]\d+/;
var object_cache: Map<string, Hovercard | null> = new Map();

type Hovercard = vscode.MarkdownString | vscode.MarkdownString[];


var selector: vscode.DocumentSelector = { scheme: 'file' };
var provider: vscode.HoverProvider = {
    provideHover: function (document, position, token): vscode.ProviderResult<vscode.Hover> {
        var wordRange = document.getWordRangeAtPosition(position, MONOGRAM_REGEX);
        if (!wordRange) {
            return null;
        }

        var mono = document.getText(wordRange);

        if (object_cache.has(mono)) {
            var value = object_cache.get(mono);

            return value ? new vscode.Hover(value, wordRange) : null;
        }

        var cwd: string | undefined = undefined;
        if (document.uri.scheme === 'file') {
            cwd = path.dirname(document.uri.path);
        }

        return new Promise((resolve, _) => {
            function handler(v: ConduitResponse) {
                if (v.error) {
                    object_cache.set(mono, null);
                }
                var hover = parsePhidLookup(v.response[mono]);
                object_cache.set(mono, hover);
                resolve(hover ? new vscode.Hover(hover, wordRange) : null);
            }

            callConduit('phid.lookup', { names: [mono] }, cwd).then(handler, handler);
        });
    }
};


function parsePhidLookup(input: ArcanistHandle): Hovercard | null {
    if (!input) {
        return null;
    }

    var icon = 'whitespace';
    switch (input.status) {
        case 'open':
            icon = 'check';
            break;
        case 'closed':
            icon = 'tag';
            break;
    }

    return new vscode.MarkdownString(
        `$(${icon}) [${input.fullName}](${input.uri})`,
        true);
}

export function register(): vscode.Disposable {
    return vscode.languages.registerHoverProvider(selector, provider);
}
