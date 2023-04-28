#!/usr/bin/env node

import osklang from "./osklang_simple.js";
import prompt_sync from "prompt-sync";
import { readFileSync } from 'fs';

const prompt = prompt_sync();

const [,,fileName] = process.argv;

if (fileName) {
  // execute file
  let code;
  try {
    code = readFileSync(fileName, 'utf8');
  } catch(e) {
    console.log('Invalid input file');
    process.exit(1);
  }

  const { error } = osklang.evaluate(fileName, code);
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