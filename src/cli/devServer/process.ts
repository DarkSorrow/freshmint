import { spawn, ChildProcess } from 'child_process';

export type CloseHandler = (code: number) => void;
export type OutputHandler = (line: string) => void;

export type ProcessHandlers = {
  onClose?: CloseHandler;
  onStdout?: OutputHandler;
  onStderr?: OutputHandler;
};

export function spawnProcess(command: string, args: string[], handlers: ProcessHandlers): ChildProcess {
  const process = spawn(command, args);

  if (handlers.onStdout) {
    process.stdout.on('data', (data) => {
      const output = String(data);

      const lines = output.split('\n');

      for (const line of lines) {
        handlers.onStdout(line);
      }
    });
  }

  if (handlers.onStderr) {
    process.stderr.on('data', (data) => {
      const output = String(data);
      handlers.onStderr(output);
    });
  }

  if (handlers.onClose) {
    process.on('close', (code) => {
      handlers.onClose(code);
    });
  }

  return process;
}
