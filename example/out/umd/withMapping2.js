define(["require","sampleModules/umdv/defineFunction","sampleModules.umd.defineFunction","./returnObject"],function(e){var t=e("sampleModules/umdv/defineFunction"),n=e("sampleModules.umd.defineFunction"),r=e("./returnObject");return function(){return t()+" "+n()+" "+r.value}});