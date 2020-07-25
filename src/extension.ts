import * as vscode from 'vscode';
import * as execa from "execa";
import * as path from "path";
import { ArcanistLintMessage } from './arcanist_types';


export function activate(context: vscode.ExtensionContext) {
	const collection = vscode.languages.createDiagnosticCollection('arc lint');

	setupCustomTranslators();

	function d(disposable: vscode.Disposable) {
		context.subscriptions.push(disposable);
	}

	d(vscode.commands.registerCommand('arc-vscode.clearLint', () => collection.clear()));

	d(vscode.workspace.onDidSaveTextDocument(onTextDocumentEvent));
	d(vscode.workspace.onDidOpenTextDocument(onTextDocumentEvent));

	if (vscode.window.activeTextEditor) {
		lintFile(vscode.window.activeTextEditor.document);
	}

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
			if (!value.stdout) return;
			try {
				const lintMessages = JSON.parse(value.stdout);

				for (const filename in lintMessages) {
					// TODO: This only probably works because we call arc with a single file.
					collection.set(document.uri, lintJsonToDiagnostics(lintMessages[filename]));
				}
			} catch {
				logError("ppfff");
			}
		}

		const filename = document.uri.path;

		execa(
			'arc', ['lint', '--output', 'json', '--', path.basename(filename)],
			{ cwd: path.dirname(filename) },
		).then(handleExecResult, handleExecResult);
	}

}

export function deactivate() {
	// TODO collection.clear();
 }

function logError(x: any) {
	console.log("this is error", x);
}

type LintTranslator = (lint: ArcanistLintMessage) => vscode.Diagnostic;
let customLintTranslator: Map<String, LintTranslator> = new Map();

function lintJsonToDiagnostics(lintResults: Array<ArcanistLintMessage>): vscode.Diagnostic[] {
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




	function translate(lint: ArcanistLintMessage): vscode.Diagnostic {
		let t = customLintTranslator.get(lint.code) || defaultTranslate;
		return t(lint);
	}

	return lintResults.map(translate);
}

function nonNeg(n: number): number {
	return n < 0 ? 0 : n
}

function defaultTranslate(lint: ArcanistLintMessage): vscode.Diagnostic {
	return {
		code: lint.code,
		message: message(lint),
		severity: severity(lint),
		source: 'arc lint',
		range: new vscode.Range(
			lint.line - 1, nonNeg(lint.char - 2), // it's an artificial 3-chars wide thing.
			lint.line - 1, lint.char + 1),
	};
}
function message(lint: ArcanistLintMessage) {
	if (lint.description)
		return lint.name + ": " + lint.description
	return lint.name
}

function severity(lint: ArcanistLintMessage): vscode.DiagnosticSeverity {
	switch (lint.severity as string) {
		case 'disabled': return vscode.DiagnosticSeverity.Hint;
		case 'autofix': return vscode.DiagnosticSeverity.Hint;
		case 'advice': return vscode.DiagnosticSeverity.Information;
		case 'warning': return vscode.DiagnosticSeverity.Warning;
		case 'error': return vscode.DiagnosticSeverity.Error;
		default: return vscode.DiagnosticSeverity.Error;
	}
}
function setupCustomTranslators() {
	customLintTranslator.set("SPELL1", lint => {
		let d = defaultTranslate(lint)

		d.message = <string>lint.description;
		let len = (<string>lint.original).length;
		if (len > 0) {
			d.range = new vscode.Range(
				lint.line - 1, nonNeg(lint.char - 1),
				lint.line - 1, lint.char + len - 1);
		}

		return d
	});

	// "This line is 116 characters long, but the convention is 80 characters."
	const re_TXT3_length = /\D(\d+) characters\.$/;

	customLintTranslator.set('E501', lint => {
		let d = defaultTranslate(lint)

		d.range = new vscode.Range(
			lint.line - 1, lint.char - 1,
			lint.line - 1, 1e9);

		return d;
	});

	customLintTranslator.set('TXT3', lint => {
		let d = defaultTranslate(lint)

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
