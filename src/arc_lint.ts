import * as vscode from 'vscode';

import {arc, ExecResult} from './exec_arc';
import { ArcanistLintMessage } from './arcanist_types';
import { setupCustomTranslators } from './arc_lint_translators';
import {TaskGroupingExecutor} from './task_grouping';

var LOG: vscode.OutputChannel;

var errorCollection: vscode.DiagnosticCollection;

export function setup(log: vscode.OutputChannel, diagnosticCollection: vscode.DiagnosticCollection) {
    LOG = log;
    errorCollection = diagnosticCollection;
    setupCustomTranslators(customLintTranslator);
    updateLintSeverityMap();
}

const linterTaskExecutor = new TaskGroupingExecutor<vscode.TextDocument>(2, lintFiles);

async function lintFiles(documents: Iterable<vscode.TextDocument>): Promise<void> {

    let docs_by_folder = new Map<vscode.WorkspaceFolder, vscode.Uri[]>();

    for (let document of documents) {
        if (document.uri.scheme !== "file") { continue; }
        const folder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!folder) { continue; }

        let doc_list: vscode.Uri[];
        if (docs_by_folder.has(folder)) {
            doc_list = docs_by_folder.get(folder)!;
        } else {
            doc_list = new Array();
            docs_by_folder.set(folder, doc_list);
        }
        doc_list.push(document.uri);
    }

    const lint_flags = ['lint', '--output', 'json', '--'];

    for (const [folder, docs] of docs_by_folder) {

        const folder_root = folder.uri.fsPath;

        let paths: string[] = new Array();
        for (let document_uri of docs) {
            //  This looks bad...
            paths.push(document_uri.fsPath.substring(folder_root.length+1));
        }

        function arcLintHandle(result: ExecResult) {
            // only remove from errorCollection when execution is done
            for (let document_uri of docs) {
                errorCollection.delete(document_uri);
            }
            handleArcLintWithPath(result, folder, errorCollection);
        }

        arc(lint_flags.concat(paths), arcLintHandle, folder_root);
    }
}

export function lintFile(document: vscode.TextDocument) {
    if (document.uri.scheme !== "file") { return; }

    linterTaskExecutor.addTask(document);
}

function handleArcLintWithPath(
    value: ExecResult,
    folder: vscode.WorkspaceFolder,
    diagnostics: vscode.DiagnosticCollection) {

    // The output is best described as "json lines" - each line is a complete
    // json object, with one key (filename). This might be a bug in Arcanist.
    for (const line of value.stdout.split(/\r?\n/)) {
        try {
            const lintMessages = JSON.parse(line);
            for (const filename in lintMessages) {
                const fileUri = vscode.Uri.joinPath(folder.uri, filename);
                diagnostics.set(fileUri, lintJsonToDiagnostics(lintMessages[filename]));
            }
        } catch (e) {
            console.log("Ignoring error", e);
        }
    }
}


export function lintEverything() {
    if (!vscode.workspace.workspaceFolders) { return; }

    for (const folder of vscode.workspace.workspaceFolders) {

        function handleArcLintEverything(value: ExecResult) {
            handleArcLintWithPath(value, folder, errorCollection);
        }

        if (folder.uri.scheme === "file") {
            arc(['lint', '--output', 'json', '--everything'],
                handleArcLintEverything,
                folder.uri.fsPath);
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

    let line = lint.line == null ? 1 : lint.line - 1;
    let char = lint.char == null ? 1 : lint.char - 1;

    if (lint.original) {
        let len = (<string>lint.original).length;
        if (len > 0) {
            return new vscode.Range(
                line, char,
                line, char + len);
        }
    }

    return new vscode.Range(
        line, char - 1, // it's an artificial 3-chars wide thing.
        line, char + 1);
}

export function defaultLintTranslator(lint: ArcanistLintMessage): vscode.Diagnostic {
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
