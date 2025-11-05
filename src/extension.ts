import * as vscode from 'vscode';
import * as lint from './arc_lint';
import * as browse from './arc_browse';
import * as hovercard from './hovercard';
import * as remarkup from './remarkup';

import * as exec_arc from './exec_arc';

export function activate(context: vscode.ExtensionContext) {
	const log = vscode.window.createOutputChannel("arcanist");

	const diagnostics = vscode.languages.createDiagnosticCollection('arc lint');

	lint.setup(log, diagnostics);
	browse.setup(log);

	function d(disposable: vscode.Disposable) {
		context.subscriptions.push(disposable);
	}
	d(diagnostics);
	d(log);

	d(hovercard.register());

	d(vscode.commands.registerCommand("arc-vscode.browseFile", browse.browseFile));

	d(vscode.commands.registerCommand('arc-vscode.clearLint', () => diagnostics.clear()));
	d(vscode.commands.registerCommand('arc-vscode.lintEverything', lint.lintEverything));

	function onTextDocumentEvent(document: vscode.TextDocument) {
		lint.lintFile(document);
	}
	d(vscode.workspace.onDidSaveTextDocument(onTextDocumentEvent));
	d(vscode.workspace.onDidOpenTextDocument(onTextDocumentEvent));
	d(vscode.workspace.onDidChangeConfiguration(onChangeConfig));

	if (vscode.window.activeTextEditor) {
		lint.lintFile(vscode.window.activeTextEditor.document);
	}

	context.subscriptions.push(...remarkup.setup(context));

	d(vscode.workspace.onDidCloseTextDocument(document => diagnostics.delete(document.uri)));

	d(vscode.commands.registerCommand("arc-vscode.invokeArc", exec_arc.arcExec));
	d(vscode.commands.registerCommand("arc-vscode.invokeConduit", exec_arc.callConduit));
	// TODO also expose invokeConduit
}

export function deactivate() { }

function onChangeConfig(e: vscode.ConfigurationChangeEvent) {
	if (!e.affectsConfiguration('arc-vscode.lint')) {
		return;
	}
	lint.updateLintSeverityMap();
}
