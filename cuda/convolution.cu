#define BLOCKSIZE 64

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <sys/time.h>
#include <iostream>
using namespace std;

void cuda_safe( cudaError_t error, char* message ){
    if( error != cudaSuccess ){
       printf( "Error: %s : %s\n", message, cudaGetErrorString( error ) );
    }
}
void calcTime( struct timeval first, struct timeval second, struct timeval *lapsed ){
    if(first.tv_usec>second.tv_usec){
        second.tv_usec += 1000000;
        second.tv_sec--;
    }
    lapsed->tv_usec = second.tv_usec - first.tv_usec;
    lapsed->tv_sec = second.tv_sec - first.tv_sec;
}
void randomize( float *a, int x, int y ){
    int i, j = 0;
    srand(time(NULL)); // generate different random numbers
    for(i=0; i<x; i++){
        for(j=0; j<y; j++){
            a[ i * y + j ] = (float) rand() / RAND_MAX;
        }
    }
}

void zeroes( float *a, int x, int y ){
    int i, j;
    for( i = 0; i < x; ++i ){
        for( j = 0; j < y; ++j ){
            a[ i * y + j ] = 0;
        }
    }
}

void pad( float *a, float *b, int x, int y, int px, int py ){
    int i, j;
    zeroes( b, x + px, y + py );
    for( i = 0; i < x; ++i ){
        for( j = 0; j < y; ++j ){
            b[ ( i + px ) * ( y + 2 * py ) + ( j + py ) ] = a[ i * y + j ];
        }
    }
}

void print( float* a, int x, int y ){
    int i, j;
    for( i = 0; i < x; ++i ){
        for( j = 0; j < y; ++j ){
            printf( "%f", a[ i * y + j ] );
            printf( j == y - 1 ? "" : ", " );
        }
        printf( ";\n" );
    }
    printf( "\n" );
}

void sconv( float* pF, float* T, float* Y, int mpF, int npF, int mT, int nT, int mY, int nY ){
    int i, j, k, l, plF, plTF, plT;
    for( i = 0; i < mY; ++i ){
        for( j = 0; j < nY; ++j ){
            for( k = 0; k < mT; ++k ){
                for( l = 0; l < nT; ++l ){
                    plF = i * npF + j;
                    plTF = k * npF + l;
                    plT = k * nT + l;
                    Y[ i * nY + j ] += pF[ plF + plTF ] * T[ plT ];
                }
            }
        }
    }
}

__global__ void cconv( float *cpF, float *cT, float *cY, int mpF, int npF, int mT, int nT, int mY, int nY ){
    int k, l, plF;
    int ix = blockIdx.x * blockDim.x + threadIdx.x;
    int i = ( int ) ix / nY;
    int j = ix - i * nY;
    plF = i * npF + j;
    float sum = 0; 

    __shared__ float sT[ 24 * 24 ];
    
    for( k = 0; k < 10; ++k ){
        if( threadIdx.x * 10 + k >= mT * nT ){
            break;
        }
        sT[ threadIdx.x * 10 + k ] = cT[ threadIdx.x * 10 + k ];
    }
    __syncthreads();
    
    for( k = 0; k < mT; ++k ){
        for( l = 0; l < nT; ++l ){
            sum += cpF[ plF + k * npF + l ] * sT[ k * nT + l ];
        }
    }
    cY[ i * nY + j ] = sum;
}


int main( int argc, char **argv ){
    if( argc != 5 ){
        printf( "we need 4 int values\n" );
        return 0;
    }
    struct timeval first, second, lapsed, third, forth;
    struct timezone tzp;
    int mF = atoi( argv[ 1 ] ),
        nF = atoi( argv[ 2 ] ),
        mT = atoi( argv[ 3 ] ),
        nT = atoi( argv[ 4 ] ),
        m = mT - 1,
        n = nT - 1,
        mY = mF + m,
        nY = nF + n,
        mpF = mF + 2 * m,
        npF = nF + 2 * n,
        totalsize, blocks,
        mres = 0, mdiff = 0;
    
    totalsize = mY * nY;
    
    blocks = totalsize / BLOCKSIZE;
    
    if( BLOCKSIZE * blocks != totalsize  ){
        mres = mY / BLOCKSIZE;
        mdiff = mY - BLOCKSIZE * mres;
        
        mpF += BLOCKSIZE - mdiff;
        mY += BLOCKSIZE - mdiff;
        totalsize = mY * nY;
        blocks++;// = totalsize / BLOCKSIZE;
    }
    
    float *F,  *T,  *Y, *pF,
          *cpF, *cT, *cY;
    
    F = (float*) malloc( sizeof( float ) * mF * nF  );
    pF = (float*) malloc( sizeof( float ) * mpF * npF );
    T = (float*) malloc( sizeof( float ) * mT * nT );
    Y = (float*) malloc( sizeof( float ) * mY * nY );
    
    cuda_safe( cudaMalloc( &cpF, sizeof( float ) * mpF * npF ), "cudaMalloc1" );
    cuda_safe( cudaMalloc( &cT, sizeof( float ) * mT * nT ), "cudaMalloc2" );
    cuda_safe( cudaMalloc( &cY, sizeof( float ) * mY * nY ), "cudaMalloc3" );
    
    randomize( F, mF, nF );
    randomize( T, mT, nT );
    zeroes( Y, mY, nY );
    pad( F, pF, mF, nF, m, n );
    cuda_safe( cudaMemcpy( cpF, pF, sizeof( float ) * mpF * npF, cudaMemcpyHostToDevice ), "cudaMemcpy1" );
    cuda_safe( cudaMemcpy( cT, T, sizeof( float ) * mT * nT, cudaMemcpyHostToDevice ), "cudaMemcpy2" );
    //cuda_safe( cudaMemcpy( cY, Y, sizeof( float ) * mY * nY, cudaMemcpyHostToDevice ), "cudaMemcpy3" );

    gettimeofday(&first, &tzp);
    sconv( pF, T, Y, mpF, npF, mT, nT, mY, nY );
    gettimeofday(&second, &tzp);
    
    gettimeofday(&third, &tzp);
    cconv<<< blocks, BLOCKSIZE >>> ( cpF, cT, cY, mpF, npF, mT, nT, mY, nY );
    cudaThreadSynchronize();
    gettimeofday(&forth, &tzp);
    
    cuda_safe( cudaMemcpy( Y, cY, sizeof( float ) * mY * nY, cudaMemcpyDeviceToHost ), "cudaMemcpy" );
    
    //print( F, mF, nF );
    //print( T, mT, nT );
    //print( Y, mY, nY );
    

    calcTime( first, second, &lapsed );
    printf("%d.%06d ", (int) lapsed.tv_sec, (int) lapsed.tv_usec);  

    calcTime( third, forth, &lapsed );
    printf("%d.%06d\n", (int) lapsed.tv_sec, (int) lapsed.tv_usec);  
    
    
    //cuda_safe( cudaFree( cpF ), "cudaFree" );
    //cuda_safe( cudaFree( cT ), "cudaFree" );
    //cuda_safe( cudaFree( cY ), "cudaFree" );
    free( F );
    free( pF );
    free( T );
    free( Y );
    return 0;
}

