__kernel void ckVectorAdd(  __global unsigned int* vectorIn1,
                            __global unsigned int* vectorIn2,
                            __global unsigned int* vectorOut,
                            unsigned int uiVectorWidth ){
    unsigned int x = get_global_id( 0 );
    if( x >= ( uiVectorWidth ) ){
        return;
    }

    vectorOut[ x ] = vectorIn1[ x ] + vectorIn2[ x ];
}
