import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
// If you have @roo-code/types installed, you can import the types. The runtime will work regardless.
// import type { RooCodeAPI } from '@roo-code/types';

type RooCodeAPI = any; // Fallback typing to avoid hard dependency at compile time

const ROO_EXTENSION_IDS = [
    'RooVeterinaryInc.roo-cline',
    'RooVeterinaryInc.roo-code'
];

const LAST_TASK_ID_KEY = 'rooDriver.lastTaskId';

async function getRooApi(): Promise<RooCodeAPI> {
    for (const id of ROO_EXTENSION_IDS) {
        const ext = vscode.extensions.getExtension<RooCodeAPI>(id);
        if (ext) {
            await ext.activate();
            return ext.exports as RooCodeAPI;
        }
    }
    throw new Error('Roo Code extension not found. Please install Roo Code (RooVeterinaryInc.roo-code).');
}

async function startRooTask(api: RooCodeAPI, taskText: string, newTab: boolean | undefined): Promise<string | undefined> {
    const result = await api.startNewTask({ task: taskText, newTab: Boolean(newTab) });
    const taskId: string | undefined = result?.id ?? result?.taskId ?? result?.data?.id;
    return taskId;
}

async function sendRooMessage(api: RooCodeAPI, text: string, taskId?: string): Promise<void> {
    // Known Roo issue: immediate send after start may race; do a light retry.
    const maxAttempts = 3;
    const delayMs = 500;
    let attempt = 0;
    while (true) {
        try {
            await api.sendMessage(text, taskId ? { taskId } : undefined);
            return;
        } catch (err) {
            attempt++;
            if (attempt >= maxAttempts) {
                throw err;
            }
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
}

export async function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel('Roo Driver');

    const startTaskCmd = vscode.commands.registerCommand('rooDriver.startTask', async (arg?: unknown) => {
        const api = await getRooApi();
        let taskText: string | undefined;
        let newTab: boolean | undefined;

        if (typeof arg === 'string') {
            taskText = arg;
        } else if (arg && typeof arg === 'object') {
            const obj = arg as { task?: string; newTab?: boolean };
            taskText = obj.task;
            newTab = obj.newTab;
        }

        if (!taskText) {
            taskText = await vscode.window.showInputBox({ prompt: 'Enter task for Roo' });
            if (!taskText) {
                return;
            }
        }

        const taskId = await startRooTask(api, taskText, newTab);
        if (taskId) {
            await context.globalState.update(LAST_TASK_ID_KEY, taskId);
            output.appendLine(`Started Roo task: ${taskId}`);
        } else {
            output.appendLine('Started Roo task (no taskId returned)');
        }
        return taskId;
    });

    const sendMessageCmd = vscode.commands.registerCommand('rooDriver.sendMessage', async (arg?: unknown) => {
        const api = await getRooApi();
        let text: string | undefined;
        let taskId: string | undefined;
        if (typeof arg === 'string') {
            text = arg;
        } else if (arg && typeof arg === 'object') {
            const obj = arg as { text?: string; taskId?: string };
            text = obj.text;
            taskId = obj.taskId;
        }
        if (!text) {
            text = await vscode.window.showInputBox({ prompt: 'Enter message to send to Roo' });
            if (!text) {
                return;
            }
        }
        if (!taskId) {
            taskId = context.globalState.get<string>(LAST_TASK_ID_KEY);
        }
        await sendRooMessage(api, text, taskId);
        output.appendLine(`Sent message to Roo${taskId ? ` (task ${taskId})` : ''}: ${text}`);
    });

    const uriHandler: vscode.UriHandler = {
        handleUri: async (uri: vscode.Uri) => {
            try {
                const api = await getRooApi();
                const params = new URLSearchParams(uri.query);
                const route = uri.path.replace(/^\//, '');
                const stateFile = params.get('stateFile') || undefined;

                if (route === 'start') {
                    const task = params.get('task') ?? '';
                    const newTab = params.get('newTab') === '1' || params.get('newTab') === 'true';
                    const taskId = await startRooTask(api, task, newTab);
                    if (taskId) {
                        await context.globalState.update(LAST_TASK_ID_KEY, taskId);
                    }
                    if (stateFile) {
                        await fs.writeFile(stateFile, JSON.stringify({ ok: true, taskId }, null, 2));
                    }
                } else if (route === 'send') {
                    const text = params.get('text') ?? '';
                    let taskId = params.get('taskId') || undefined;
                    if (!taskId) {
                        taskId = context.globalState.get<string>(LAST_TASK_ID_KEY);
                    }
                    await sendRooMessage(api, text, taskId);
                    if (stateFile) {
                        await fs.writeFile(stateFile, JSON.stringify({ ok: true, taskId }, null, 2));
                    }
                } else {
                    vscode.window.showWarningMessage(`Unknown roo-driver route: ${route}`);
                }
            } catch (err: any) {
                const message = err?.message ?? String(err);
                vscode.window.showErrorMessage(`roo-driver error: ${message}`);
            }
        }
    };

    context.subscriptions.push(startTaskCmd, sendMessageCmd, vscode.window.registerUriHandler(uriHandler));
}

export function deactivate() {}

