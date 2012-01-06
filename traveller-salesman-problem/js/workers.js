var Workers = {
    threadNum: 4,
    workers: [],
	Log: function( text, who ){
		debug && console.log( "Worker " + who + ": " + text );
	},
    Init: function(){
		debug && console.log( "Workers.Init()" );
        Workers.threadNum = Cookies.read( 'threadNum' ) || 4;
        Cookies.write( 'threadNum', Workers.threadNum );
        for( var i = 0; i < Workers.threadNum; ++i ){
            this.workers[ i ] = new Worker( "js/worker.js?" + version );
        }
    },
    Restart: function(){
		debug && console.log( "Workers.Init()" );
        for( var i = 0; i < this.workers.length; ++i ){
            this.workers[ i ].terminate();
        }
        for( var i = 0; i < Workers.threadNum; ++i ){
            this.workers[ i ] = new Worker( "js/worker.js?" + version );
        }
		if( tsp.data.cities ){
            Workers.Submit( { 
                command: "cities",
                cities: tsp.data.cities
            } );
		}
		if( tsp.data.route ){
			Workers.Submit( {
				command: "route",
				route: tsp.data.route
			} );
		}
    },
    Submit: function( data ){
		debug && console.log( "Workers.Submit()" );
		if( this.workers.length != this.threadNum ){
			this.Restart();
		}
        for( var i = 0; i < this.threadNum; ++i ){
			this.workers[ i ].postMessage( JSON.stringify( { command: "prepare" } ) );
            this.workers[ i ].postMessage( JSON.stringify( data ) );
        }
    },
    Solve: function( partition, callback ){
		debug && console.log( "Workers.Solve()" );
		if( this.workers.length != this.threadNum ){
			this.Restart();
		}
        var begin = new Date().getTime();
        partition = partition.concat();
        var size = partition.length;
        var results = [];
        for( var i = 0; i < this.threadNum; ++i ){
            this.workers[ i ].postMessage( JSON.stringify({
                command: 'calculate',
                partition: [ partition.shift() ],
                i: i
            } ) );
            this.workers[ i ].onmessage = function( event ){
                var data = JSON.parse( event.data );
				if( data.command == "log" ){
					Workers.Log( data.text, data.i )
					return;
				}
                results.push( data );
                if( results.length < size ){
                    if( !partition.length ){
                        return;
                    }
                    Workers.workers[ data.i ].postMessage( JSON.stringify({
                        command: 'calculate',
                        partition: [ partition.shift() ],
                        i: data.i
                    } ) );
                }
                else{
                    var min = 1;
                    var flip;
                    for( var j = 0; j < results.length; ++j ){
                        if( results[ j ].gain < min ){
                            min = results[ j ].gain;
                            flip = results[ j ].flip;
                        }
                    }
                    callback( { min: min, flip: flip, time: new Date().getTime() - begin } );
                }
            }
        }
    }
};