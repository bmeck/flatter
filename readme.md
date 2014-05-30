# flatter.js

## usage

run `node flatter.js` in a node module directory

generates commands to flatten a nested directory structure using symlinks
flattened directories become named `node_modules/f~{{id}}`
this does not run the commands, it merely prints them

## side effects

* most side effects are solved by the use of symlinks, however realpaths that
  depend on nested node_modules will be broken.

also, don't do that anyway

