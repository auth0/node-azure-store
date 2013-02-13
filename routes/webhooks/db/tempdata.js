var tempdata = module.exports;

tempdata.create = function(hookData, callback) {
  // TODO
  this.hookData = hookData; // fake
  callback();
};

tempdata.get = function(criteria, callback) {
  // TODO
  callback(null, this.hookData); // fake
};
