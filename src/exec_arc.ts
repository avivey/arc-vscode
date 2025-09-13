import spawn, { Result, SubprocessError } from 'nano-spawn';

export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode?: number;
}
type Handler = ((x: ExecResult) => void);

export type ConduitHandler = (x: ConduitResponse) => void;
export interface ConduitResponse {
    error?: string; // TODO check
    errorMessage?: string; // TODO check
    response: any;
}

export function arc(args: string[], handler: Handler, cwd?: string) {
    spawn('arc', args, { cwd: cwd }).then(handler, handler);
}

async function arcExec(args: string[], cwd?: string): Promise<ExecResult> {
    try {
        let p = await spawn('arc', args, { cwd: cwd });
        return p;
    } catch (error) {
        return error as SubprocessError;
    }
}

export function callConduit(method: string, body: object, handler: ConduitHandler, cwd?: string) {
    function hs(value: Result) {
        const output = JSON.parse(value.stdout);
        handler(output);
    }
    spawn('arc', ['call-conduit', '--', method], {
        stdin: JSON.stringify(body),
        cwd: cwd,
    }).then(hs, hs);
}
