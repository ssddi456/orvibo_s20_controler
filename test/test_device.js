// device emulater
// 
// 
// listen from app then repeat it,
// get echo then send to app,
// 

var orvibo_s20_controler = require('./..');

var master = new orvibo_s20_controler.orvibo_master();
var s = master.socket;
s.removeAllListeners('message');
var app_ip = '192.168.1.101';

var path = require('path');
var nedb = require('nedb');
var storage = new nedb({ filename : path.join(__dirname,'./device.db'), autoload : true});


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
var local_info = get_local_ip('IPv4')[0];

function record ( msg ) {
  var info = orvibo_s20_controler.parse_message(msg);
  // console.log( JSON.stringify(info.hex, null, 2), '\n');
  return info;
}


s.on('message', function( msg, rinfo ) {
  var remote_ip = rinfo.address;

  if( remote_ip == app_ip ){
    console.log( remote_ip, 'do record app msg,  ready to repeat');
    record(msg);
  } else if( remote_ip == local_info.address ){

    // console.log(remote_ip, 'loopback message, skip');

  }else{
    console.log(remote_ip, 'do record client msg, ready to repeat');
    var info  = record(msg);
    var device = info.origin;

    device.ip = remote_ip;
    device.hex_mac = info.hex.mac.join('');

    if( master.has(device) ){
      device = master.has(device);

      // setTimeout(function() {
      //   if( info.origin.last_bit ){
      //     master.off(device);
      //   } else {
      //     master.on(device);
      //   }
      // }, 3e3);

    } else {
      master.subscribe( device );
      console.log('device has subscribed' ,  device.hex_mac, info.origin.last_bit );
    }
  }
});

setTimeout(function() {
  master.discover();
}, 10);

// 看起来 s20c 使用了新的协议
// 开关将会建立一个wifi接入点，app接入到此接入点来输入配置
// 设置完成服务之后也不再使用udp发送控制协议
// 看来需要抓到手机的包？虚拟机赶脚又可以派上用场了。
