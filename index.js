var dgram = require('dgram');
var util = require('util');

var localip = '192.168.1.100';

var padding = new Buffer([0x20,0x20,0x20,0x20,0x20,0x20]);
var zeros   = new Buffer([0x00,0x00,0x00,0x00]);

var cmd_head      = new Buffer([ 0x68, 0x64, 0x00 ]);
var cmd_discover  = new Buffer([ 0x06, 0x71, 0x61 ]);
var cmd_subscribe = new Buffer([ 0x1e, 0x63, 0x6c ]);
var cmd_control   = new Buffer([ 0x17, 0x64, 0x63 ]);



function get_local_ip( family ) {
  var os = require('os');
  var info = os.networkInterfaces();
  var ret = Object.keys(info).map(function( k ) {
    var details = info[k];
    details = details.filter(function( n ) {
      return n.family == family && !n.internal;
    });
    return details;
  });
  return [].concat.apply([], ret);
}


var get_socket = function() {
  var s = dgram.createSocket({
    type : 'udp4',
    reuseAddr  : true
  });

  s.bind(10000);
  return s;
}

function parse_message ( msg ) {
  var hex = [].map.call(msg,function( chr) {
    chr = chr.toString('16');
    return chr.length == 1 ? '0'+chr : chr;
  });

  var str = hex.join('');
  var mac_start = str.indexOf('accf')
  if(mac_start != -1){
    mac_start = mac_start/2
    var mac_sign = hex.slice( mac_start, mac_start + 6 * 4  );
  }

  var ret = {
    origin  : {
      data : msg,
      last_bit : msg[msg.length-1]
    },
    hex     : {
      data : hex,
      last_bit : hex[hex.length-1]
    }
  };

  if(mac_sign){
    ret.hex.mac_sign = mac_sign;
    ret.hex.mac      = hex.slice(mac_start, mac_start+6);

    ret.origin.mac_sign = msg.slice(mac_start, mac_start+6*4);
    ret.origin.mac      = msg.slice(mac_start, mac_start+6);
  }

  return ret;
}

var orvibo_device = function() {
    var s = this.socket = get_socket();
    var self = this;
    s.on('listening',function() {
      var address = s.address();
      self.ip = address.address ;
      self.port = address.port;
      console.log( 'socket inited, ip %s port %s', self.address , self.port);
    });

    s.on('message', this.handle.bind(this));    
};
var odp = orvibo_device.prototype;

odp.send   = function( message, target ) {
  this.socket.send( message, 0, message.length, 10000, target || '192.168.1.255');
};

odp.handle = function( msg, rinfo ) {
  console.log('Received %d bytes from %s:%d\n',
              msg.length, rinfo.address, rinfo.port);
  console.log( msg.toJSON() );
};




var orvibo_master = function(s) {
  orvibo_device.call(this, s);
  this.devices = {};
};
util.inherits(orvibo_master, orvibo_device);
var omp = orvibo_master.prototype;

omp.discover = function() {
  this.send(
    Buffer.concat([cmd_head, cmd_discover]));
};

omp.subscribe = function(device){
  this.devices[device.hex_mac] = device;
  this.send( 
    Buffer.concat([cmd_head, cmd_subscribe, device.mac_sign ]),
    device.ip);
};

omp.has = function( device ) {
  return this.devices[device.hex_mac];
};

omp.on  = function( device ) {
  this.send( 
    Buffer.concat([cmd_head, cmd_control, device.mac, padding, zeros, new Buffer([1]) ]),
    device.ip);
};

omp.off = function( device ) {
  this.send( 
    Buffer.concat([cmd_head, cmd_control, device.mac, padding, zeros, new Buffer([0]) ]),
    device.ip);
};

var orvibo_client = function(s) {
  orvibo_device.call(this, s);
  var local_info = get_local_ip('IPv4')[0];
};

util.inherits(orvibo_client, orvibo_device);
var ocp = orvibo_client.prototype;
ocp.handle = function(msg, info) {
  
}

module.exports.orvibo_device = orvibo_device;
module.exports.orvibo_master = orvibo_master;
module.exports.orvibo_client = orvibo_client;

module.exports.parse_message = parse_message;
module.exports.get_local_ip = get_local_ip;