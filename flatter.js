//
// # flatter.js
//
// ## usage
//
// run `node flatter.js` in a node module directory
//
// generates commands to flatten a nested directory structure using symlinks
// flattened directories become named `node_modules/f~{{id}}`
// this does not run the commands, it merely prints them
//
// ## side effects
//
// * most side effects are solved by the use of symlinks, however realpaths that
//   depend on nested node_modules will be broken.
//
// also, don't do that anyway
//
var fs = require('fs');
var path = require('path');

function map(dir, finish) {
  var to_map = [];
  var to_crawl = [{
    dir: dir
  }];
  var uuid = 0;
  var flattened_modules = {
    // original_path -> destination_path
  };
  function next() {
    setImmediate(crawl);
  }
  function crawl() {
    var crawl_target = to_crawl.shift();
    if (!crawl_target) {
      finish(null, flattened_modules);
      return;
    }
    
    // get submodules
    var dir = crawl_target.dir;
    
    function mapDir(dir) {
      var existing_module = flattened_modules[dir];
      if (!existing_module) {
        var id = ++uuid;
        existing_module = flattened_modules[dir] = {
          id: id,
          original_dir: dir,
          submodules: []
        };
      }
      return existing_module;
    }
    mapDir(dir);
    
    testForPackage(dir, next);
    
    function testForPackage(dir, cb) {
      var pkgPath = path.join(dir, 'node_modules');
      fs.stat(pkgPath, function (err, stat) {
        if (stat && stat.isDirectory()) {
          handleSubmodules(dir, cb);
        }
        else {
          mapModules(crawl_target.modules_in_scope_by_name);
          cb(null);
        }
      });
    }
    
    function mapModules(modules_in_scope_by_name) {
      // map existing modules
      for (var module_in_scope in modules_in_scope_by_name) {
        var original_dir = modules_in_scope_by_name[module_in_scope];
        var existing_module = mapDir(original_dir);
        var module_path = path.join(dir, 'node_modules', module_in_scope);
        if (existing_module) {
          flattened_modules[module_path] = existing_module;
        }
        mapDir(dir).submodules.push({
          name: module_in_scope,
          module: existing_module
        });
      }
    }
    
    function handleSubmodules(dir, cb) {
      fs.readdir(path.join(dir, 'node_modules'), function (err, submodules) {
        if (err) {
          cb(err);
          return;
        }
        submodules = submodules.filter(function (submodule) {
          return submodule !== '.bin' && !/^f\~/.test(submodule);
        });
        
        // add submodules to module scope
        var modules_in_scope_by_name = Object.create(crawl_target.modules_in_scope_by_name || null);
        submodules.forEach(function (submodule) {
          modules_in_scope_by_name[submodule] = path.join(dir, 'node_modules', submodule);
        });
        
        // queue submodules for nested crawling
        submodules.forEach(function (submodule) {
          to_crawl.push({
            dir: modules_in_scope_by_name[submodule],
            modules_in_scope_by_name: modules_in_scope_by_name
          });
        });
        
        mapModules(modules_in_scope_by_name);
        
        cb(null);
      });
    };
  }
    
  next();
}
function generateBAT(dir, cb) {
  map(dir, function (err, mappings) {
    if (err) {
      cb(err, null);
      return;
    }
    var visited = {};
    var to_cp = Object.keys(mappings).map(function (original_dir) {
      var mapping = mappings[original_dir];
      original_dir = original_dir.slice(dir.length+1);
      if (!original_dir) {
        return '';
      }
      if (visited[mapping.id]) {
        return '';
      }
      visited[mapping.id] = true;
      var target_dir = path.join('node_modules','f~'+mapping.id);
      // copy the mapped modules
      return 'xcopy '+original_dir+' '+target_dir + ' /s /i\n' +
      // make a link to the "root" submodules
          (original_dir.split('/').length === 3?'mklink '+original_dir+' '+target_dir +'\n': '')+
      // make links for mapped module's submodles
          mapping.submodules.map(function(submodule) {
            var sub_dir = path.join('..', '..', '..','node_modules','f~'+submodule.module.id);
            return 'mklink '+target_dir+'/node_modules/'+submodule.name+' '+sub_dir + '\n';
          }).join('')+'\n';
    }).join('');
    cb(null, to_cp);
  });
}
generateBAT(process.cwd(), function (err, bat_src) {
  console.log(bat_src)
});