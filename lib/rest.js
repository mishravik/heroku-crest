/**
 * Copyright 2013 Ricard Aspeljung. All Rights Reserved.
 * Last updates by Enrico Murru (2015) (http://enree.co)
 * rest.js
 * crest
 */

var MongoClient = require("mongodb").MongoClient,
  BSON = require("mongodb").BSONPure,
  mongo = require("mongodb"),
  server = module.parent.exports.server,
  config = module.parent.exports.config,
  debug = module.parent.exports.debug,
  restify = module.parent.exports.restify,
  util = require("./util").util;

debug("rest.js is loaded");


/**
 * Query
 */
function handleGet(req, res, next) {
  debug("GET-request recieved");
  var query;
  console.log('Params:',req.params);
  // Providing an id overwrites giving a query in the URL
  if (req.params.id) {
    query = {
      '_id': mongo.ObjectID.createFromHexString(req.params.id)
    };
  } else {
    query = req.query.query ? util.parseJSON(req.query.query, next, restify) : {};
  }
  var options = req.params.options || {};

  var test = ['limit', 'sort', 'fields', 'skip', 'hint', 'explain', 'snapshot', 'timeout'];

  var v;
  for (v in req.query) {
    if (test.indexOf(v) !== -1) {
      options[v] = req.query[v];
    }
  }

  if(options.sort){
    options.sort = util.parseJSON(options.sort, next, restify);
  }
  if(options.fields){
    options.fields = util.parseJSON(options.fields, next, restify); 
  }

  if (req.body.toString().length > 0) {
    var body = req.body.split(",");
    if (body[0]) {
      query = util.parseJSON(body[0], next);
    }
    if (body[1]) {
      options = util.parseJSON(body[1], next);
    }
  }
  console.log("Query:", query, "Options",options);
  MongoClient.connect(util.connectionURL(req.params.db, util.getAuthenticationFromRequest(req), config), function (err, db) {
    if(err){
      console.log('e1', err);
      return res.json(500,err);
    }
    db.collection(req.params.collection, function (err, collection) {
      if(err){
        console.log('e2',err);
        return res.json(500,err);
      }
      collection.find(query, options, function (err, cursor) {
        if(err){
          console.log('e3',err);
          return res.json(500,err);
        }
        cursor.toArray(function (err, docs) {
          if(err){
            console.log('e4',err);
            res.json(500,err);
          }else{
            var result = [];
            if (req.params.id) {
              if (docs.length > 0) {
                result = util.flavorize(docs[0], "out");
                res.json(result, {'content-type': 'application/json; charset=utf-8'});
              } else {
                res.json(404);
              }
            } else {
              docs.forEach(function (doc) {
                result.push(util.flavorize(doc, "out"));
              });
              res.json(result, {'content-type': 'application/json; charset=utf-8'});
            }
          }
          db.close();
        });
      });
    });
  });
}

server.get('/:db/:collection/:id?', handleGet);
server.get('/:db/:collection', handleGet);


/**
 * Insert
 */
server.post('/:db/:collection', function (req, res) {
  debug("POST-request recieved");
  if (req.params) {
    MongoClient.connect(util.connectionURL(req.params.db, util.getAuthenticationFromRequest(req), config), function (err, db) {
      if(err){
        console.log("e1",err);
        return res.json(500,err);
      }
      var collection = db.collection(req.params.collection);
      
      var coll = Array.isArray(req.params) ? util.cleanParams(req.params[0]) : util.cleanParams(req.params);
      if(Array.isArray(req.params) && req.params.length > 0){
        return res.json(500,'Only one insert at a time supported');
      }
      util.parseJsonRecursive(coll);
      // We only support inserting one document at a time
      collection.insert(coll, function (err, docs) {
        if(err){
          console.log("e2",err);
          return res.json(500,err);
        }
        
        res.header('Location', '/' + req.params.db + '/' + req.params.collection + '/' + docs.ops[0]._id.toHexString());
        res.set('content-type', 'application/json; charset=utf-8');
        res.json(200, docs.ops[0]);
        db.close();
      });
    });
  } else {
    res.set('content-type', 'application/json; charset=utf-8');
    res.json(500, {"error": "no parameters"});
  }
});

/**
 * Update
 */
server.put('/:db/:collection/:id', function (req, res) {
  debug("PUT-request recieved");
  var spec = {
    '_id': mongo.ObjectID.createFromHexString(req.params.id)
  };
  MongoClient.connect(util.connectionURL(req.params.db, util.getAuthenticationFromRequest(req), config), function (err, db) {
    if(err){
      console.log('e1',err);
      return res.json(500,err);
    }
    db.collection(req.params.collection, function (err, collection) {
      if(err){
        console.log('e2',err);
        return res.json(500,err);
      }
      var coll = Array.isArray(req.params) ? util.cleanParams(req.params[0]) : util.cleanParams(req.params);
      util.parseJsonRecursive(coll);
      collection.update(spec, coll, true, function (err, docs) {
        if(err){
          console.log('e3',err);
          return res.json(500,err);
        }
        res.set('content-type', 'application/json; charset=utf-8');
        res.json(200, docs.ops[0]);
      });
    });
  });
});

/**
 * Delete
 */
server.del('/:db/:collection/:id', function (req, res) {
  debug("DELETE-request recieved");
  var spec = {
    '_id': new BSON.ObjectID(req.params.id)
  };
  MongoClient.connect(util.connectionURL(req.params.db, util.getAuthenticationFromRequest(req), config), function (err, db) {
    if(err){
      console.log(err);
      return res.json(500,err);
    }
    db.collection(req.params.collection, function (err, collection) {
      if(err){
        console.log(err);
        return res.json(500,err);
      }
      collection.remove(spec, function (err, docs) {
        if(err){
          console.log(err);
          return res.json(500,err);
        }
        res.set('content-type', 'application/json; charset=utf-8');
        res.json(200, docs);
        db.close();
      });
    });
  });
});
