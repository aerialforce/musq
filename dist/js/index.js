/*
You may not re-upload raw mp3 and ogg files used in the code. Please edit the
mp3 and ogg before upload it elsewhere.
Feel free to use your own sound source.

* the synth was made from synth1 and the drums are taken from copyright-free 
  sample pack

*Contact : https://soundcloud.com/999777fra

*/
(function(){
  
  Object.extend(Array.prototype, {
    chain: function(f) {
      var ret = _V(this[0]);
      if(f(ret)) return ret;
      
      for(var i = 1, l = this.length; i < l; i++) {
        ret = _V(this[i], ret);
        if(f.apply(ret)) return ret;
      }
      return ret;
    },
    
    andThen: function() {
      return this.chain(function(e) {return e === null;});
    },

    orThen: function() {
      return this.chain(function(e) {return e !== null;});
    }
  });
  
  Object.extend(Number.prototype, {
    toRadian: function() {
      return 2.0 * Math.PI * this;
    }
  });
  
  
  var loadAudio = function() {
    var sacrifice = document.createElement('audio');
    if (!sacrifice) {
      alert('Your browser does not support <audio>!');
      return;
    }
    function checkSupportFor(type) {
      var cpt = sacrifice.canPlayType(type);
      return (cpt !== "no") && (cpt !== "");
    }
    var supports_mp3 = checkSupportFor("audio/mp3");
    var supports_ogg = checkSupportFor("audio/ogg");
    
    if (!(supports_mp3 || supports_ogg)) {
      alert('Your browser does not support mp3 nor ogg!');
      return;
    }
        
    // load audio
    var instruments =
      $R(1, 10).map(function(e) {
        return new Audio("dist/audio/synth/" + e + (supports_ogg ? ".ogg" : ".mp3"));
      }).concat(
         ["kick", "hat", "snare"].map(function(e) {
           return new Audio("dist/audio/drums/" + e + (supports_ogg ? ".ogg" : ".mp3"));
      }));

    instruments.each(function(e) {
      e.addEventListener("canplay", function() {
        e.playable = true;
      }, true);
      e.load();
    });
    return instruments;
  };
  
  var measure = 16;
  var pitchMax = 13;
  var audioBufferCap = 2;
 
  var d = new DCore().init();
  
  // extend Number
  Object.extend(Array.prototype, {
    translate: function(a) {
      if(!(a instanceof Array)) a = Array.prototype.slice.call(arguments);
      
      return this.map(function(x) {
        return x.zip2(a, function(e) {
          return e[0] + e[1];
        });
      });
    },
    rotate: function(radian) {
      if(this.length === 0) return this;
      else if(this[0] instanceof Array) return this.map(function(e) {return e.rotate(radian);});
      else if(this.length !== 2) return this;
      else return [this[0] * Math.cos(radian) - this[1] * Math.sin(radian),
                   this[0] * Math.sin(radian) + this[1] * Math.cos(radian)];
    },
    scale: function(a) {
      if(!(a instanceof Array)) a = Array.prototype.slice.call(arguments);
      return this.map(function(x) {
        return x.zip2(a, function(e) {
          return e[0] * e[1];
        });
      });
    }
  });

  
  
  var counter = function counter(max) {
    var count = 0;
    return function() {
      if(count > max) return null;
      else return count++;
    };
  };

  var Motion = {
    counter: counter.curry(4),
    normal: function(args) {
      var count = args[0], shape = args[1];
      return [count, shape];
    },
    born: function(args) {
      return Motion.shake(args);
    },
    rotate: function(args) {
      var count = args[0], shape = args[1];
      var rad = (count / 4 / 4).toRadian();
      return [count, shape.rotate(rad)];
    },
    scale: function(args) {
      var count = args[0], shape = args[1];
      var s = (Math.sin((count / 8).toRadian())) * 0.6;
      return [count, shape.scale(1 + s, 1 + s)];
    },
    shake: function(args) {
      var count = args[0], shape = args[1];
      var f = 0.1 * (4 - count);
      var x = (Math.random() - 0.5) * f;
      var y = (Math.random() - 0.5) * f;
      return [count, shape.scale(1 + x, 1 + y)];
    },
    upset: function(args) {
      var count = args[0], shape = args[1];
      var s = Math.cos((count / 9).toRadian());
      return [count, shape.scale(1, s)];
    }
  };

  function Score() {
    this.seek = 0;
    this.fineSeek = 0;
    this.notes = $R(0, measure - 1).map(function(pos) {
      return $R(0, pitchMax - 1).map(function(inst) {
        return new Note(pos / (measure + 1) + Note.prototype.size * 2
                      , (inst / pitchMax + Note.prototype.size * 2) * 0.85 + 0.05
                      , instruments[pos % audioBufferCap][inst]
                      , inst);
      });
    });
  }
  Score.prototype = {
    fineSeekMax: 32,
    click: function(px, py) {
      this.notes.flatten().filter(function(e) {
        return e.isInBoundOf(px, py);
      }).each(function(e) {
        e.flipFlop();
        if(!e.killed) {
          e.setMotion(Motion.born);
//          e.play();
        }
      });
    },
    act: function() {
      var self = this;
      this.fineSeek++;
      this.fineSeek %= this.fineSeekMax;
      this.seek = ~~(this.fineSeek * measure / this.fineSeekMax);
      var motion = [];
      if(!this.notes[this.seek][10 + 0].killed) motion.push(Motion.rotate);
      if(!this.notes[this.seek][10 + 1].killed) motion.push(Motion.upset);
      if(!this.notes[this.seek][10 + 2].killed) motion.push(Motion.scale);
      motion.push(Motion.shake);
      
      var actives = [];
      if(this.fineSeek % (this.fineSeekMax / measure) === 0) {
        this.notes[this.seek].each(function(e) {
          if(!e.killed) {
            e.setMotion(motion);
            actives[[e.x, e.y].join(",")] = true;
          }
        });
      }
      
      this.notes.flatten().each(function(e) {
        e.act(actives[[e.x, e.y].join(",")]);
      });
    },
    draw: function() {
      this.notes.flatten().map(function(e) {
        e.clear();
        return e;
      }).each(function(e) {
        e.draw();
      });
    }
  };

  function Note(x, y, inst, pitch) {
    this.x = x;
    this.y = y;
    this.killed = true;
    this.mementoKilled = true;
    this.setMotion(Motion.normal);
    this.instrument = inst;
    this.pitch = pitch;
    this.mementoShape = [];
    this.shape = [];
    this.dirty = true;
    this.playable = false;
    this.mementoPlayable = false;
  }

  Note.prototype = {
    size: 1.0 / measure / 2 * 0.55,
    offsets: 0.008,
    shapePrototype: [
      [-1,-1],
      [ 1,-1],
      [ 1, 1],
      [-1, 1]
    ].scale(1.0 / measure / 2 * 0.55, 1.0 / measure / 2 * 0.55),
    isInBoundOf: function(x, y) {
      return this.x - this.size <= x && x <= this.x + this.size + this.offsets
          && this.y - this.size <= y && y <= this.y + this.size + this.offsets;
    },
    baseMotion: function(count) {
      return [count, Note.prototype.shapePrototype];
    },
    flipFlop: function() {
      this.mementoKilled = this.killed;
      this.killed ^= true;
    },
    setMotion: function(motion) {
      this.motion = [
        Motion.counter(),
        this.baseMotion
      ].concat(motion);
    },
    active: function(count) {
    },
    unactive: function(count) {
    },
    normal: function(count) {
      return this.shapePrototype;
    },
    play: function() {
      var inst = this.instrument;
      if(inst) {
        if(inst.playable) {
          inst.currentTime = 0;
          inst.play();
        }
      }
    },
    act: function(active) {
      if(active) this.play();
      
      this.mementoPlayable = this.playable;
      this.playable = this.instrument.playable;
      

      // save current shape as memento
      this.mementoShape = this.shape;
      
      var temp = this.motion.andThen();
      this.shape = temp === null ? this.shapePrototype : temp.last();

      // shape changed
      this.dirty = this.shape.toString()
        !== this.mementoShape.toString()
      this.dirty |= this.playable
        !== this.mementoPlayable
      this.dirty |= this.killed
        !== this.mementoKilled;
    },
    clear: function() {
      if(!this.dirty) return;
      
      var offsets = this.offsets;
      var shape = this.mementoShape;
      // rawed
      d
        .rgb(0xff, 0xff, 0xff)
        .quads(shape.scale(1.1, 1.1).translate([this.x, this.y]).translate([offsets, offsets]))
        .fill()
        ;
    },
    draw: function() {
     
      if(!this.dirty) return;
      if(!this.playable) return;

      var offsets = this.offsets;
      var shape = this.shape;
      

      if(this.killed) {
        if(this.pitch < 10) d.rgb(204, 255, 153); //lightgreen
        else d.rgb(0xb0, 0xe0, 0xe6); //lightblue
      
        // rawed
        d
          .quads(shape.translate([this.x, this.y]).translate([offsets, offsets]))
          .fill()
          ;
      } else {
        if(this.pitch < 10) d.rgb(0x99, 0xcc, 0x00); //yellowgreen
        else d.rgb(0x00, 0xcc, 0xff); //skyblue
    
        d
         .quads(shape.translate([this.x, this.y]).translate([offsets, offsets]))
         .fill()
        ;
      }
    }
  };

  var instruments = [];
  (function() {
    
    instruments[0] = loadAudio();
    if(!instruments[0]) return;
    instruments[1] = loadAudio();
    instruments[2] = loadAudio();
    instruments[3] = loadAudio();
    
    // observe mouse click
    document.addEventListener("click", function(e) {
      var px = e.clientX / d.width - d.left2d;
      var py = e.clientY / d.height - d.top2d;
      score.click(px, py);
    }, false);

    var n = new Note(0.5, 0.5, 1);
    var score = new Score();

    d.rgb(0xff, 0xff, 0xff)
     .fillBack();
    
    window.setInterval(
      (function() {
        
        score.act();
        
        score.draw();
        
      }), 66);
  })();
})();