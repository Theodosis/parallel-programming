var Cookies = {
    read: function( name ){
        var cookies = document.cookie.split( ';' );
        for( var i = 0; i < cookies.length; ++i ){
            
            cookies[ i ] = cookies[ i ].split( '=' );
            if( cookies[ i ][ 0 ][ 0 ] == " " ){
                cookies[ i ][ 0 ] = cookies[ i ][ 0 ].substr( 1 );
            }
            if( cookies[ i ][ 0 ] == name ){
                return cookies[ i ][ 1 ];
            }
        }
        return;
    },
    write: function( name, value ){
        var date = new Date();
        date.setTime( date.getTime() + 365 * 24 * 3600 * 1000 );
        document.cookie = name + " = " + value + "; expires=" + date.toGMTString() + ";";
    },
    remove: function( values ){
        if( typeof value == "string" ){
            values = values.split( ' ' );
        }
        for( var i = 0; i < values.length; ++i ){
            document.cookie = values[ i ] + "=;expires=Thu, 01-Jan-1970 00:00:01 GMT";
        }
    }
}
