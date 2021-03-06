let Gibber = {
  Utility:       require( './utility.js' ),
  Communication: require( './communication.js' ),
  Environment:   require( './environment.js' ),
  Scheduler:     require( './clock.js' ),
  Theory:        require( './theory.js' ),
  Examples:      require( './example.js' ),
  Max:           null,
  Gen:           null,
  Euclid:        null,
  Seq:           null,
  Score:         null,
  Pattern:       null,
  Arp:           null,
  currentTrack:  null,
  codemirror:    null,
  max:           null,
  '$':           null,

  export() {
    window.Steps         = this.Steps
    window.Seq           = this.Seq
    window.Score         = this.Score
    window.Track         = this.Track
    window.Scheduler     = this.Scheduler
    window.Pattern       = this.Pattern
    window.Euclid        = this.Euclid
    window.Arp           = this.Arp
    window.Communication = this.Communication
    window.log           = this.log
    window.Theory        = this.Theory
    window.Scale         = this.Theory.Scale.master
    window.signals       = this.Max.signals
    window.params        = this.Max.params
    window.namespace     = this.Max.namespace
    window.devices       = this.Max.devices
    window.clear         = this.clear

    window.note = v => {
       return window.Theory.Note.create( v )
    }
    
    Gibber.Gen.export( window )

    this.Utility.export( window )
  },

  init() {
    //this.max = window.max
    this.$   = Gibber.Utility.create

    this.Environment.init( Gibber )
    this.Theory.init( Gibber )
    this.log = this.Environment.log

    if( this.Environment.debug ) {
      this.Scheduler.mockRun()
    }else{
      this.Communication.init( Gibber ) 
    }

    //this.currentTrack = this.Track( this, 1 ) // TODO: how to determine actual "id" from Max?
    
    //this.initSingletons( window )

    this.export()
  },

  singleton( target, key ) {
    if( Array.isArray( key ) ) {
      for( let i = 0; i < key.length; i++ ) {
        Gibber.singleton( target, key[ i ] )
      }
      return
    }
    
    if( target[ key ] !== undefined ) {
      delete target[ key ]
    }

    let proxy = null
    Object.defineProperty( target, key, {
      get() { return proxy },
      set(v) {
        if( proxy && proxy.clear ) {
          proxy.clear()
        }

        proxy = v
      }
    })
  },

  initSingletons: function( target ) {
		var letters = "abcdefghijklmnopqrstuvwxyz"
    
		for(var l = 0; l < letters.length; l++) {

			var lt = letters.charAt(l);
      Gibber.singleton( target, lt )
      
    }
  },

  clear() {
    setTimeout( () => {
      //for( let key in Gibber.currentTrack.markup.textMarkers ) {
      //  let marker = Gibber.currentTrack.markup.textMarkers[ key ]

      //  if( marker.clear ) marker.clear() 
      //}
      Gibber.Seq.proto.__clearAll__()
      Gibber.Max.clear()

    }, 500 )

    Gibber.Gen.clear()
    Gibber.Environment.codeMarkup.clear()
  },

  // overrideName is used to specify a unique identifier for messages
  // targeting external applications. Messages that only target internal
  // objects (like Scale.root, velocity, etc.) do not need an overrideName.
  // overrideNames typically consist of a unique device id + the method name
  // for sequencing.

  addSequencingToMethod( obj, methodName, priority, overrideName ) {
    
    if( !obj.sequences ) obj.sequences = {}
    if( overrideName === undefined ) overrideName = methodName 
    
    let lastId = 0
    obj[ methodName ].seq = function( values, timings, id=0, delay=0 ) {
      let seq
      lastId = id

      if( obj.sequences[ methodName ] === undefined ) obj.sequences[ methodName ] = []

      if( obj.sequences[ methodName ][ id ] ) {
        let s = obj.sequences[ methodName ][ id ]
        let markers = obj.markup.textMarkers[ s.values.patternName ]
        if( markers === undefined ) {
          markers = []
          obj.markup.textMarkers[ s.values.patternName ] = markers
        }else if( Array.isArray( markers ) ) {
          markers.forEach( m => m.clear() )
        }else{
          let count = 0
          while( markers[ count ] !== undefined ) {
            markers[ count ].clear()
            count++
          }

          markers.clear()
        }

        let binop = obj.markup.textMarkers[ s.values.patternName + '_binop' ]
        if( binop !== undefined ) binop.clear()

        if( s.values.cycle !== undefined ) s.values.cycle.clear()

        markers = obj.markup.textMarkers[ s.timings.patternName ]

        if( Array.isArray( markers ) ) {
          markers.forEach( m => m.clear() )
        }else{
          let count = 0
          while( markers[ count ] !== undefined ) {
            markers[ count ].clear()
            count++
          }

          //markers.clear()
        }

        binop = obj.markup.textMarkers[ s.timings.patternName + '_binop' ]
        if( binop !== undefined ) binop.clear()
       
        if( s.timings.cycle !== undefined ) s.timings.cycle.clear()

        obj.sequences[ methodName ][ id ].clear()

      }

      // we pass methodName initially so that note and chord filters are correctly applied 
      // by Seq initializer. Then we change the key to the overrideName for sequencing
      // external messages.
      obj.sequences[ methodName ][ id ] = seq = Gibber.Seq( values, timings, methodName, obj, priority )
      seq.trackID = obj.id

      if( id === 0 ) {
        obj[ methodName ].values  = obj.sequences[ methodName ][ 0 ].values
        obj[ methodName ].timings = obj.sequences[ methodName ][ 0 ].timings
      }
  
      // change seq.key for external sequencing
      if( methodName !== overrideName ) seq.key = overrideName

      obj[ methodName ][ id ] = seq

      seq.delay( delay )
      seq.start()

      return seq
    }
    
    obj[ methodName ].seq.delay = v => obj[ methodName ][ lastId ].delay( v )

    obj[ methodName ].seq.stop = function() {
      obj.sequences[ methodName ][ 0 ].stop()
      return obj
    }

    obj[ methodName ].seq.start = function() {
      obj.sequences[ methodName ][ 0 ].start()
      return obj
    }


  },

  addSequencingToProtoMethod( proto, methodName ) {
    proto[ methodName ].seq = function( values, timings, id = 0 ) {

      if( this.sequences === undefined ) this.sequences = {}

      if( this.sequences[ methodName ] === undefined ) this.sequences[ methodName ] = []

      if( this.sequences[ methodName ][ id ] ) this.sequences[ methodName ][ id ].stop() 

      this.sequences[ methodName ][ id ] = Gibber.Seq( values, timings, methodName, this ).start() // 'this' will never be correct reference

      if( id === 0 ) {
        this.values  = this.sequences[ methodName ][ 0 ].values
        this.timings = this.sequences[ methodName ][ 0 ].timings
      }

      this[ id ] = this.sequences[ methodName ][ id ]
      
      this.seq.stop = function() {
        this.sequences[ methodName ][ 0 ].stop()
        return this
      }.bind( this )

      this.seq.start = function() {
        this.sequences[ methodName ][ 0 ].start()
        return this
      }.bind( this )
    }
  },



  addMethod( obj, methodName, parameter, _trackID, overrideNamespace ) {
    let v = 0,
        p,
        trackID = isNaN( _trackID ) ? obj.id : _trackID,
        seqKey = `${obj.address} ${methodName}`

    //console.log( "add method trackID", trackID )

    Gibber.Seq.proto.externalMessages[ seqKey ] = ( value, beat ) => {
      let msg = `add ${beat} ${obj.path} ${methodName} ${value}` 
      return msg
    }
    
    obj[ methodName ] = p = ( _v ) => {
      // if( p.properties.quantized === 1 ) _v = Math.round( _v )
      console.log( 'set', methodName )

      if( _v !== undefined ) {
        if( typeof _v === 'object' && _v.isGen ) {
          _v.assignTrackAndParamID( trackID, parameter.id )

          // if a gen is not already connected to this parameter, push
          if( Gibber.Gen.connected.find( e => e.paramID === parameter.id ) === undefined ) {
            Gibber.Gen.connected.push( _v )
          }

          Gibber.Gen.lastConnected = _v
          //Gibber.Communication.send( `gen ${parameter.id} "${_v.out()}"` )
          //Gibber.Communication.send( `select_track ${ trackID }` )
          
          // disconnects for fades etc.
          if( typeof _v.shouldKill === 'object' ) {
            Gibber.Utility.future( ()=> {
              Gibber.Communication.send( `ungen ${parameter.id}` )
              Gibber.Communication.send( `set ${parameter.id} ${_v.shouldKill.final}` )

              let widget = Gibber.Environment.codeMarkup.genWidgets[ parameter.id ]
              if( widget !== undefined && widget.mark !== undefined ) {
                widget.mark.clear()
              }
              delete Gibber.Environment.codeMarkup.genWidgets[ parameter.id ]
            }, _v.shouldKill.after )
          }
          
          v = _v
        }else{
          if( v.isGen ) {
            Gibber.Communication.send( `ungen ${parameter.id}` )
            let widget = Gibber.Environment.codeMarkup.genWidgets[ parameter.id ]
            if( widget !== undefined && widget.mark !== undefined ) {
              widget.mark.clear()
            }
            delete Gibber.Environment.codeMarkup.genWidgets[ parameter.id ]
          }

          v = _v
          //Gibber.Communication.send( `set ${parameter.id} ${v}` )
          console.log( obj.address, methodName )
          Gibber.Communication.send( `${obj.address} ${methodName} ${v}` )
        }
      }else{
        return v
      }
    }

    p.properties = parameter

    Gibber.addSequencingToMethod( obj, methodName, 0, seqKey )
  }
}

Gibber.Pattern = require( './pattern.js' )( Gibber )
Gibber.Seq     = require( './seq.js' )( Gibber )
Gibber.Score   = require( './score.js' )( Gibber )
Gibber.Arp     = require( './arp.js' )( Gibber )
Gibber.Euclid  = require( './euclidean.js')( Gibber )
Gibber.Gen     = require( './gen.js' )( Gibber )
Gibber.Steps   = require( './steps.js' )( Gibber )
Gibber.Max     = require( './max.js'  )( Gibber )

module.exports = Gibber
