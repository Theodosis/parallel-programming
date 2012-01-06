__kernel void clDesaturate( __global const uchar4* src,
                            __global uchar4* dst,
                            uint width,
                            uint height ){
    int x = get_global_id( 0 );
    int y = get_global_id( 1 );
    if( x >= width || y >= height ){
        return;
    }
    int i = y * width + x;
    
    uchar4 color = src[ i ];
    uchar lum = ( uchar ) ( 0.30f * color.x + 0.59f * color.y + 0.11f * color.z );
    dst[ i ] = ( uchar4 ) ( lum, lum, lum, 255 );
}
