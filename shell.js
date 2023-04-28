#!/usr/bin/env node

import osklang from "./osklang_simple.js";
import prompt_sync from "prompt-sync";
import { readFileSync } from 'fs';

const prompt = prompt_sync();

const [,,...args] = process.argv;

if (args[0]) {
  // execute file
  let code;
  try {
    code = readFileSync(args[0], 'utf8');
  } catch(e) {
    console.log('Invalid input file');
    process.exit(1);
  }

  const { error } = osklang.evaluate(args[0], code);
  if (error) console.log(error);
} else {
  // open repl
  while (true) {
    const input = prompt("> ");
    if (input === null) break;
  
    const { output, error } = osklang.evaluate('<stdin>', input, 0);
    
    if (error) {
      console.log(error);
      continue;
    }
    
    console.log(output);
  }
}