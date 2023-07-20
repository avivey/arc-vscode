import * as vscode from 'vscode';
import * as execa from 'execa';
import * as path from 'path';

import { ArcanistLintMessage } from './arcanist_types';
import { setupCustomTranslators } from './arc_lint_translators';


var LOG: vscode.OutputChannel;

export function setup(log: vscode.OutputChannel) {
    LOG = log;
    setupCustomTranslators(customLintTranslator);
    updateLintSeverityMap();
}

export function lintFile(document: vscode.TextDocument, errorCollection: vscode.DiagnosticCollection) {
    if (document.uri.scheme !== "file") { return; }

    function handleExecResult(value: execa.ExecaReturnValue<string>) {
        if (!value.stdout) {
            errorCollection.delete(document.uri);
            return;
        }
        try {
            const lintMessages = JSON.parse(value.stdout);

            for (const filename in lintMessages) {
                // TODO: This only probably works because we call arc with a single file.
                errorCollection.set(document.uri, lintJsonToDiagnostics(lintMessages[filename]));
            }
        } catch (e) {
            console.log("Ignoring error", e);
        }
    }

    const filename = document.uri.path;

    LOG.appendLine("linting "+ filename);

    execa(
        'arc', ['lint', '--output', 'json', '--', path.basename(filename)],
        { cwd: path.dirname(filename) },
    ).then(handleExecResult, handleExecResult);
}

export function lintEverything(errorCollection: vscode.DiagnosticCollection) {
    if (!vscode.workspace.workspaceFolders) { return; }

    for (const folder of vscode.workspace.workspaceFolders) {

        function handleArcLintEverything(value: execa.ExecaReturnValue<string>) {
            // The output is best described as "json lines" - each line is a complete
            // json object, with one key (filename). This might be a bug in Arcanist.
            for (const line of value.stdout.split(/\r?\n/)) {
                try {
                    const lintMessages = JSON.parse(line);
                    for (const filename in lintMessages) {
                        const fileUri = vscode.Uri.joinPath(folder.uri, filename);
                        errorCollection.set(fileUri, lintJsonToDiagnostics(lintMessages[filename]));
                    }
                } catch (e) {
                    console.log("Ignoring error", e);
                }
            }
        }

        if (folder.uri.scheme === "file") {
            execa(
                'arc', ['lint', '--output', 'json', '--everything'],
                { cwd: folder.uri.fsPath },
            ).then(handleArcLintEverything, handleArcLintEverything);
        }
    }
}

/**

Possible Extra features:
- quick-fix to apply patch
- try to get better message by parsing `description` field (per message code...)
- `locations` may be parsed into `relatedInformation`.
*/
export type LintTranslator = (lint: ArcanistLintMessage) => vscode.Diagnostic;
let customLintTranslator: Map<String, LintTranslator> = new Map();

export function getRangeForLint(lint: ArcanistLintMessage): vscode.Range {

    let line = lint.line == null? 1: lint.line -1;
    let char = lint.char == null? 1: lint.char -1;

    if (lint.original) {
        let len = (<string>lint.original).length;
        if (len > 0) {
            return new vscode.Range(
                line, char,
                line, char + len);
        }
    }

    return new vscode.Range(
        line, char -1, // it's an artificial 3-chars wide thing.
        line, char +1);
}

export function defaultLintTranslator(lint: ArcanistLintMessage): vscode.Diagnostic {
    let range = getRangeForLint(lint);

    return {
        code: lint.code,
        message: message(lint),
        severity: severity(lint),
        source: 'arc lint',
        range: getRangeForLint(lint),
    };
}

function message(lint: ArcanistLintMessage) {
    if (lint.description) { return lint.name + ": " + lint.description; }
    return lint.name;
}

let lintSeverityMap: Map<String, vscode.DiagnosticSeverity>;
export function updateLintSeverityMap(): void {
    let config = vscode.workspace.getConfiguration('arc-vscode.lint');
    let maxLevel: vscode.DiagnosticSeverity;
    switch (config.maxDiagnosticsLevel as string) {
        case 'hint': maxLevel = vscode.DiagnosticSeverity.Hint; break;
        case 'info': maxLevel = vscode.DiagnosticSeverity.Information; break;
        case 'warning': maxLevel = vscode.DiagnosticSeverity.Warning; break;
        case 'error':
        default:
            maxLevel = vscode.DiagnosticSeverity.Error; break;
    }

    function capped(level: vscode.DiagnosticSeverity): vscode.DiagnosticSeverity {
        return level > maxLevel ? level : maxLevel;
    }

    lintSeverityMap = new Map();
    lintSeverityMap.set('disabled', capped(vscode.DiagnosticSeverity.Hint));
    lintSeverityMap.set('autofix', capped(vscode.DiagnosticSeverity.Information));
    lintSeverityMap.set('advice', capped(vscode.DiagnosticSeverity.Information));
    lintSeverityMap.set('warning', capped(vscode.DiagnosticSeverity.Warning));
    lintSeverityMap.set('error', capped(vscode.DiagnosticSeverity.Error));
}

function severity(lint: ArcanistLintMessage): vscode.DiagnosticSeverity {
    return lintSeverityMap.get(lint.severity as string) || vscode.DiagnosticSeverity.Error;
}


function lintJsonToDiagnostics(lintResults: Array<ArcanistLintMessage>): vscode.Diagnostic[] {
    function translate(lint: ArcanistLintMessage): vscode.Diagnostic {
        let t = customLintTranslator.get(lint.code) || defaultLintTranslator;
        return t(lint);
    }

    return lintResults.map(translate);
}
