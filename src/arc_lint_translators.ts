import * as vscode from 'vscode';

import { LintTranslator, defaultLintTranslator } from './arc_lint';


export function setupCustomTranslators(translators: Map<String, LintTranslator>) {

    translators.set('E501', lint => {
        return defaultLintTranslator(lint, {lengthFinder: _ => 1e9});
    });

    // "This line is 116 characters long, but the convention is 80 characters."
    const re_TXT3_length = /\D(\d+) characters\.$/;
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


}
