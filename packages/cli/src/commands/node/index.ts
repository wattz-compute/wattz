import { Command } from 'commander';
import { registerInit } from './init';
import { registerStart } from './start';
import { registerStatus } from './status';
import { registerStop } from './stop';

export function registerNodeCommand(program: Command): void {
  const node = program
    .command('node')
    .description('Operate a Wattz GPU inference node (init, start, status, stop).');
  registerInit(node);
  registerStart(node);
  registerStatus(node);
  registerStop(node);
}
