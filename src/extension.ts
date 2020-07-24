import * as vscode from 'vscode';
import * as execa from "execa";
import * as path from "path";


export function activate(context: vscode.ExtensionContext) {
	const collection = vscode.languages.createDiagnosticCollection('arc lint');
	if (vscode.window.activeTextEditor) {
		lintFile(vscode.window.activeTextEditor.document);
	}

	function d(disposable: vscode.Disposable) {
		context.subscriptions.push(disposable);
	}

	d(vscode.commands.registerCommand('arc-vscode.clearLint', () => collection.clear()));

	d(vscode.workspace.onDidSaveTextDocument(onTextDocumentEvent));
	d(vscode.workspace.onDidOpenTextDocument(onTextDocumentEvent));

	d(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			lintFile(editor.document);
		}
	}));

	function onTextDocumentEvent(document: vscode.TextDocument) {
		lintFile(document);
	}

	function lintFile(document: vscode.TextDocument) {
		if (document.uri.scheme != "file") return;

		function handleExecResult(value: execa.ExecaReturnValue<string>) {
			const lintMessages = JSON.parse(value.stdout);

			for (const filename in lintMessages) {
				// TODO: This only probably works because we call arc with a single file.
				collection.set(document.uri, lintJsonToDiagnostics(lintMessages[filename]));
			}
		}

		const filename = document.uri.path;

		execa(
			'arc', ['lint', '--output', 'json', '--', path.basename(filename)],
			{ cwd: path.dirname(filename) },
		).then(handleExecResult, handleExecResult);
	}

}

export function deactivate() { }

function logError(x: any) {
	console.log("this is error", x);
}

function lintJsonToDiagnostics(lintResults: Array<any>): vscode.Diagnostic[] {
	/*
	input: Array of:
 		{
            "line": 248,
            "char": 23,
            "code": "SPELL1",
            "severity": "warning",
            "name": "Possible Spelling Mistake",
            "description": "Possible spelling error. You wrote 'seperator', but did you mean 'separator'?",
            "original": "Seperator",
            "replacement": "Separator",
            "granularity": 1,
            "locations": [],
            "bypassChangedLineFiltering": null,
            "context": "    magic = COLOR_RED;\n    break;\n  case 30:\n    // printf(\"Record Seperator\");\n    magic = COLOR_BLUE;\n    break;\n  case 31:"
        }
	output: array of:
		{
			code: '',
			message: 'cannot assign twice to immutable variable `x`',
			range: new vscode.Range(new vscode.Position(3, 4), new vscode.Position(3, 10)),
			severity: vscode.DiagnosticSeverity.Error,
			source: '',
			relatedInformation: [
				new vscode.DiagnosticRelatedInformation(new vscode.Location(document.uri, new vscode.Range(new vscode.Position(1, 8), new vscode.Position(1, 9))), 'first assignment to `x`')
			]
		}
	*/

	/*
		Extra features:
		- quick-fix to apply patch
		- try to get better message by parsing `description` field (per message code...)
		- `locations` may be parsed into `relatedInformation`.
	*/

	function message(lint: any) {
		if (lint.description)
			return lint.name + ": " + lint.description
		return lint.name
	}

	function severity(lint: any): vscode.DiagnosticSeverity {
		switch (lint.severity as string) {
			case 'disabled': return vscode.DiagnosticSeverity.Hint;
			case 'autofix': return vscode.DiagnosticSeverity.Hint;
			case 'advice': return vscode.DiagnosticSeverity.Information;
			case 'warning': return vscode.DiagnosticSeverity.Warning;
			case 'error': return vscode.DiagnosticSeverity.Error;
			default: return vscode.DiagnosticSeverity.Error;
		}
	}


	return lintResults.map(lint => {
		return {
			code: lint.code,
			message: message(lint),
			severity: severity(lint),
			source: 'arc lint',
			range: new vscode.Range(lint.line - 1, 0, lint.line - 1, 1e9),
		}
	})
}
