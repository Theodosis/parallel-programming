this.cache = {};
this.size = 0;
this.working = 0;
debug = false;
function Eucledian( c1, c2 ){
	if( c1 > c2 ){
		c1 = [ c2, c2 = c1 ][ 0 ];
	}
	var cc1 = this.cities[ c1 ];
	var cc2 = this.cities[ c2 ];
	if( this.cache[ c1 ] && this.cache[ c1 ][ c2 ] ){
		return this.cache[ c1 ][ c2 ];
	}
	if( this.size >= 300000 ){
		return Math.sqrt( Math.pow( cc1[ 0 ] - cc2[ 0 ], 2 ) + Math.pow( cc1[ 1 ] - cc2[ 1 ], 2 ) );
	}
	
	if( !this.cache[ c1 ] ){
		this.cache[ c1 ] = {};
	}
	this.cache[ c1 ][ c2 ] = Math.sqrt( Math.pow( cc1[ 0 ] - cc2[ 0 ], 2 ) + Math.pow( cc1[ 1 ] - cc2[ 1 ], 2 ) );
	++this.size;
	return this.cache[ c1 ][ c2 ];
}
function log( text, whoami ){
    postMessage( JSON.stringify( { 
		command: "log",
        text: text,
        i: whoami,
    } ) );
}
function solve( partition, whoami ){
	debug && log( "Solving partition " + partition, whoami );
	if( this.working ){
		debug && log( "postponing...", whoami );
		setTimeout( function(){
			solve( partition, whoami );
		}, 500 );
		return;
	}
	
	var min = Infinity;
	
    var cities = this.cities;
    var route = this.route;

    var gain = 0;
    var flip = [ 0, 0, 0 ];
	var count = 0;
    for( var i = 0; i < partition.length; ++i ){
		var rp;
		for( var j = route.length - 1; j > 0; --j ){
			if( partition[ i ] == route[ j ] ){
				rp = j;
				break;
			}
		}
        if( null == rp ){
            continue;
        }
		
        var ci  = route[ rp ]; //cities[ route[ rp ] ];
        var ci1 = route[ rp + 1 ]; //cities[ route[ rp + 1 ] ];
		var cici1 = Eucledian( ci, ci1 );
		
        for ( var j = rp + 2; j <= route.length - 2; j++ ){
            var cj  = route[ j ]; //cities[ route[ j ] ];
            var cj1 = route[ j + 1 ]; //cities[ route[ j + 1 ] ];
			var cicj = Eucledian( ci, cj );
			var cjcj1 = Eucledian( cj, cj1 );
            for ( var k = j + 1; k < route.length - 2; k++ ){
                var ck  = route[ k ]; //cities[ route[ k ] ];
                var ck1 = route[ k + 1 ]; //cities[ route[ k + 1 ] ];
                var d1 = cicj + Eucledian( ci1, ck ) + Eucledian( cj1, ck1 );
                var d2 = cici1 + cjcj1 + Eucledian( ck, ck1 );
                var newgain = d1 - d2;
                
                if( newgain < gain ){
                    gain = newgain;
                    flip = [ rp, j, k ];
                }
				++count;
            }
        }
    }
	debug && log( "No of calculations: " + count, whoami );
    postMessage( JSON.stringify( { 
		command: "results",
        gain: gain,
        flip: flip,
        i: whoami,
    } ) );
}


onmessage = function( event ){
    var data = JSON.parse( event.data );
    switch( data.command ){
		case "prepare":
			++this.working;
			break;
        case "cities":
            this.cities = data.cities;
			--this.working;
            break;
        case "route":
            this.route = data.route;
			--this.working;
			this.cache = [];
			this.size = 0;
            break;
        case "calculate":
            solve( data.partition, data.i );
            break;
    }
}

