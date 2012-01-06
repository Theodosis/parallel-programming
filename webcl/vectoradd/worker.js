onmessage = function( event ){
    var results = JSON.parse( event.data );
    var v1 = results.v1;
    var v2 = results.v2;
    var length = results.vectorLength;
    var v3 = [];
    for( var i = 0; i < length; ++i ){
        v3[ i ] = v1[ i ] + v2[ i ];
    }
    postMessage( JSON.stringify( v3 ) );
}
