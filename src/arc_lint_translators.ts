import * as vscode from 'vscode';

import { LintTranslator, defaultLintTranslator } from './arc_lint';
import { nonNeg } from './misc';


export function setupCustomTranslators(translators: Map<String, LintTranslator>) {
    translators.set("SPELL1", lint => {
        let d = defaultLintTranslator(lint);

        d.message = <string>lint.description;
        let len = (<string>lint.original).length;
        if (len > 0) {
            d.range = new vscode.Range(
                lint.line - 1, nonNeg(lint.char - 1),
                lint.line - 1, lint.char + len - 1);
        }

        return d;
    });

    // "This line is 116 characters long, but the convention is 80 characters."
    const re_TXT3_length = /\D(\d+) characters\.$/;

    translators.set('E501', lint => {
        let d = defaultLintTranslator(lint);

        d.range = new vscode.Range(
            lint.line - 1, lint.char - 1,
            lint.line - 1, 1e9);

        return d;
    });

    translators.set('TXT3', lint => {
        let d = defaultLintTranslator(lint);

        let match = (<string>lint.description).match(re_TXT3_length);
        if (match) {
            let len = parseInt(match[1]);
            d.range = new vscode.Range(
                lint.line - 1, len,
                lint.line - 1, 1e9);
        }

        return d;
    });

    // "This comment has a TODO."
    translators.set("XHP16", lint => {
        let d = defaultLintTranslator(lint);

        d.range = new vscode.Range(
            lint.line - 1, lint.char - 1,
            lint.line - 1, lint.char + 3);

        return d;
    })
}
