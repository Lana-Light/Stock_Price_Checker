/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;

var MongoClient = require('mongodb');

const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});
var NodeClient = require('node-rest-client').Client;

var nodeClient = new NodeClient();


module.exports = function(app) {

    return MongoClient.connect(CONNECTION_STRING, {
            useNewUrlParser: true
        })
        .then(client => {
            var stocks = client.db('cloud').collection('stocks');
            
            app.route('/api/stock-prices')
                .get(function(req, res) {

                    var stock = req.query.stock;
                    var stockArr = [];
                    var like = req.query.like;

                    function pr(stock) {
                        return new Promise((resolve, reject) => {
                            var url = `https://api.iextrading.com/1.0/stock/${stock}/price`;
                            nodeClient.get(url, function(data, response) {
                                if(typeof data === 'number') {
                                    stocks.find({
                                            stock
                                        })
                                        .toArray(function(err, doc) {
                                            if(err) {
                                                reject('err in db');
                                            } else if(!doc.length) {
                                                var likes = 0;
                                                var ips = [];
                                                if(like == 'true') {
                                                    likes = 1;
                                                    if(req.headers['x-forwarded-for']) {
                                                        var ip = req.headers['x-forwarded-for'].split(',')[0];
                                                        ips.push(ip);
                                                    }
                                                }
                                                stocks.insertOne({
                                                    stock,
                                                    likes,
                                                    ips
                                                }, function(err, doc) {
                                                    if(err) {
                                                        reject('err in db');
                                                    } else {
                                                        stockArr.push({
                                                            stock,
                                                            price: data + '',
                                                            likes
                                                        });
                                                        resolve('insert');
                                                    }
                                                });
                                            } else {
                                                (async function() {
                                                    likes = doc[0].likes;
                                                    if(like == 'true') {
                                                        if(req.headers['x-forwarded-for']) {
                                                            var ip = req.headers['x-forwarded-for'].split(',')[0];
                                                            if(doc[0].ips.indexOf(ip) == -1) {
                                                                likes++;
                                                                await stocks.updateOne({
                                                                        stock
                                                                    }, {
                                                                        $inc: {
                                                                            likes: 1
                                                                        },
                                                                        $push: {
                                                                            ips: ip
                                                                        }
                                                                    })
                                                                    .catch(err => reject('err in db'));
                                                            }
                                                        } else {
                                                            likes++;
                                                            await stocks.updateOne({
                                                                    stock
                                                                }, {
                                                                    $inc: {
                                                                        likes: 1
                                                                    }
                                                                })
                                                                .catch(err => reject('err in db'));
                                                        }
                                                    }
                                                    stockArr.push({
                                                        stock,
                                                        price: data + '',
                                                        likes
                                                    });
                                                    resolve('found');
                                                })();

                                            }
                                        });
                                } else {
                                    reject('incorrect stock');
                                }
                            });
                        });
                    }
                    if(Array.isArray(stock) && stock.length === 2) {
                        pr(stock[0].toUpperCase())
                            .then(result => {
                                return pr(stock[1].toUpperCase());
                            })
                            .then(result => {
                                stockArr[0].rel_likes = stockArr[0].likes - stockArr[1].likes;
                                stockArr[1].rel_likes = stockArr[1].likes - stockArr[0].likes;
                                delete stockArr[0].likes;
                                delete stockArr[1].likes;
                                res.json({
                                    stockData: stockArr
                                });
                            })
                            .catch(err => {
                                res.json(err);
                            });
                    } else {
                        pr(stock.toUpperCase())
                            .then(result => {
                                res.json({
                                    stockData: stockArr[0]
                                });
                            }, err => res.json(err));
                    }
                });

        }, err => {
            console.log(err);
        });

};