import { Command } from 'commander';
import { registerList } from './list';
import { registerPublish } from './publish';

export function registerModelCommand(program: Command): void {
  const model = program
    .command('model')
    .description('Manage models in the Wattz PDA model registry.');
  registerList(model);
  registerPublish(model);
}
