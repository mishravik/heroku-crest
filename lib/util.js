/**
 * Copyright 2013 Ricard Aspeljung. All Rights Reserved.
 *
 * util.js
 * crest
 */

var mongo = require("mongodb"),
  config = module.parent.parent.exports.config,
  debug = module.parent.parent.exports.debug;
var atob = require('atob')

debug("util.js is loaded");

module.exports.util = {
  /*
   * flavorize - Changes JSON based on flavor in configuration
   */
  flavorize: function (doc, direction) {
    if (direction === "in") {
      if (config.flavor === "normal") {
        if(!doc.id) return;
        delete doc.id;
      }
    } else {
      if(!doc._id) return;
      if (config.flavor === "normal") {
        var id = doc._id.toHexString();
        delete doc._id;
        doc.id = id;
      } else {
        doc._id = doc._id.toHexString();
      }
    }
    return doc;
  },
  cleanParams: function (params) {
    var clean = JSON.parse(JSON.stringify(params));
    if (clean.id) {
      delete clean.id;
    }
    if (clean.db) {
      delete clean.db;
    }
    if (clean.collection) {
      delete clean.collection;
    }
    return clean;
  },
  // This function handles special types
  parseJsonRecursive: function (obj) {
    for (var k in obj) {
        if (typeof obj[k] == "object" && obj[k] !== null){
          if(obj[k]['$oid']){
            obj[k] = mongo.ObjectId.createFromHexString(obj[k]['$oid']);
          }if(obj[k]['$date']){
            obj[k] = new Date(obj[k]['$date']);
          }else{
            this.parseJsonRecursive(obj[k]);
          }
        }
    }
  },
  parseJSON: function (data, next, restify) {
    var json;
    try {
      json = JSON.parse(data);
      this.parseJsonRecursive(json);
    } catch (e) {
      return next(new restify.InvalidArgumentError("Not valid JSON data."));
    }
    return json;
  },
  connectionURL: function (dbName, creds, config) {
    var auth = "";
    if (config.db.username && config.db.password) {
      auth = config.db.username + ":" + config.db.password + "@";
    }
    if(creds){
      auth = creds.username + ":" + creds.password + "@";
    }
    return "mongodb://" 
      + auth 
      + (process.env.MONGODB_HOST || config.db.host) 
      + ":" 
      + (process.env.MONGODB_PORT || config.db.port) 
      + "/" 
      + dbName; // + "?maxPoolSize=20";
  },
  getAuthenticationFromRequest: function(req){
    if(req.headers && req.headers.authorization){
      var authHeader = req.headers.authorization;
      var headSplit = authHeader.trim().split(/ /);
      if(headSplit && headSplit.length === 2 
        && headSplit[0] 
        && headSplit[0].trim().toLowerCase() === 'basic'){
        var base64 = headSplit[1];
        base64 = atob(base64);
        var creds = base64.split(':');
        return {
          username: creds[0],
          password: creds[1],
        };
      }
    }
    return;
  }
};