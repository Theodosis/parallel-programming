#include "kmeans.h"
#include <float.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <mpi.h>
#include <time.h>
#include <sys/time.h>

#define threshold 0.001

struct timeval lapsed, lapsed2, innerlapsed;

double euclidean_distance(double *v1, double *v2, int length){

    int i = 0, rank;
    double dist = 0;

    MPI_Comm_rank( MPI_COMM_WORLD, &rank );
    for(i=0; i<length; i++){
        dist += (v1[i] - v2[i])*(v1[i] - v2[i]); 
    }
    return dist;
}


void kmeans_process(data_struct *data_in, data_struct *clusters, double *newCentroids, double* tempCentroids, double* SumOfDist){
  struct timeval first, second, third, forth;
  struct timezone tzp;
  
    int i, j, k, total, rank;
    double tmp_dist = 0;
    int tmp_index = 0;
    double min_dist = 0;
    double *dataset = data_in->dataset;
    double *centroids = clusters->dataset;
    unsigned int *Index = data_in->members;
    unsigned int *cluster_size = clusters->members;

    SumOfDist[0] = 0;

    for(i=0; i<clusters->secondary_dim; i++){
        cluster_size[i] = 0;
    }

    MPI_Comm_size( MPI_COMM_WORLD, &total );
    MPI_Comm_rank( MPI_COMM_WORLD, &rank );
    int ppp = data_in->secondary_dim / total;
    int end = ppp + data_in->secondary_dim - ppp * total; //points for a normal proccess plus the remaining points
    int rem = data_in->secondary_dim - ppp * total;
    MPI_Request req;
    for( i = 1; i < total; ++i ){
        MPI_Isend( clusters->dataset, clusters->secondary_dim * clusters->leading_dim, MPI_DOUBLE, i, 2, MPI_COMM_WORLD, &req );
    }
    for(i=0; i<end; i++){
        tmp_dist = 0;
        tmp_index = 0;
        min_dist = FLT_MAX;
        for(k=0; k<clusters->secondary_dim; k++){
            tmp_dist = euclidean_distance(dataset+i*data_in->leading_dim, centroids+k*clusters->leading_dim, data_in->leading_dim);
            if(tmp_dist<min_dist){
                min_dist = tmp_dist;
                tmp_index = k;
            }
        }
   
        Index[i] = tmp_index;
        SumOfDist[0] += min_dist;
        cluster_size[tmp_index]++;
        for(j=0; j<data_in->leading_dim; j++){
            newCentroids[tmp_index * clusters->leading_dim + j] += dataset[i * data_in->leading_dim + j]; 
        }
   
    }
    MPI_Status status;
    for( i = 1; i < total; ++i ){
        MPI_Recv( tempCentroids, clusters->secondary_dim * ( clusters->leading_dim + 1 ) + 1, MPI_DOUBLE, i, 3, MPI_COMM_WORLD, &status );
        for( j = 0; j < clusters->secondary_dim; ++j ){
            for( k = 0; k < clusters->leading_dim; ++k ){
                newCentroids[ j * clusters->leading_dim + k ] += tempCentroids[ j * ( clusters->leading_dim + 1 ) + k ];
            }
            cluster_size[ j ] += tempCentroids[ j * ( clusters->leading_dim + 1 ) + clusters->leading_dim ];
        }
        SumOfDist[0] += tempCentroids[ ( clusters->leading_dim + 1 ) * clusters->secondary_dim ];
    }
    /*update cluster centers*/
    for(k=0; k<clusters->secondary_dim; k++){
        for(j=0; j<data_in->leading_dim; j++){
            centroids[k * clusters->leading_dim + j] = newCentroids[k * clusters->leading_dim + j] / (double) cluster_size[k];
        }
    }

}

void cluster(data_struct *data_in, data_struct *clusters, int max_iterations){ 
    int iter, i, j;
    double SumOfDist = 0, new_SumOfDist = 0, done=1;
    double* newCentroids;
    double *tempCentroids;
    int total, rank;
    MPI_Comm_size( MPI_COMM_WORLD, &total );
    MPI_Comm_rank( MPI_COMM_WORLD, &rank );
    int ppp = (int)data_in->secondary_dim / total;
    int rem = data_in->secondary_dim - ppp * total;
    newCentroids = (double*)malloc(clusters->leading_dim*clusters->secondary_dim*sizeof(double));
    tempCentroids = (double*)malloc( ( ( clusters->leading_dim + 1 )*clusters->secondary_dim + 1 )*sizeof(double));//plus the members of the centroid
    

    MPI_Request req;
    for( i = 1; i < total; ++i ){
        MPI_Isend( data_in->dataset + i * data_in->leading_dim * ppp + rem, ppp * data_in->leading_dim, MPI_DOUBLE, i, 1, MPI_COMM_WORLD, &req );
    }
    for(iter=0; iter<max_iterations; iter++){
        new_SumOfDist = 0;
        for(i=0; i<clusters->secondary_dim; i++){
            for(j=0; j<clusters->leading_dim; j++){
                newCentroids[i * clusters->leading_dim + j] = 0;
            }
        }
        kmeans_process(data_in, clusters, newCentroids, tempCentroids, &new_SumOfDist);
        if(fabs(SumOfDist - new_SumOfDist)<threshold){
            break;
        }
        SumOfDist = new_SumOfDist;
    }

    for( i = 1; i < total; ++i ){
        MPI_Isend( &done, 1, MPI_DOUBLE, i, 2, MPI_COMM_WORLD, &req ); 
    }
    MPI_Status status;
    for( i = 1; i < total; ++i ){
        MPI_Recv( data_in->members + rem + ppp * i, ppp, MPI_UNSIGNED, i, 4, MPI_COMM_WORLD, &status );
    }
    free(newCentroids);
    free(tempCentroids);
}

void newproc( data_struct *data_in, data_struct *clusters ){
    double sumOfDist;
    double tmp_dist = 0;
    int tmp_index = 0, i, j, k, count;
    double min_dist = 0;
    MPI_Request req;
    double * tempCentroids;
    tempCentroids = (double*)malloc( ( ( clusters->leading_dim + 1 )*clusters->secondary_dim + 1 )*sizeof(double));
    MPI_Status status;
    MPI_Recv( data_in->dataset, data_in->leading_dim * data_in->secondary_dim, MPI_DOUBLE, 0, 1, MPI_COMM_WORLD, &status );
    
    int rank;
    MPI_Comm_rank( MPI_COMM_WORLD, &rank );
        
    while( 1 ){
        tmp_dist = 0;
        tmp_index = 0;
        min_dist = 0;
        MPI_Recv( clusters->dataset, clusters->leading_dim * clusters->secondary_dim, MPI_DOUBLE, 0, 2, MPI_COMM_WORLD, &status );
        MPI_Get_count( &status, MPI_DOUBLE, &count );
        if( count == 1 ){
            break;
        }
        for( i = 0; i < clusters->secondary_dim; ++i ){
            for( j = 0; j < clusters->leading_dim + 1; ++j ){
                tempCentroids[ i * ( clusters->leading_dim + 1 ) + j ] = 0;
            }
        }
        tempCentroids[ clusters->secondary_dim * ( clusters->leading_dim + 1 ) ] = 0;
        for( i = 0; i<data_in->secondary_dim; i++){ //run through points
            tmp_dist = 0;
            tmp_index = 0;
            min_dist = FLT_MAX;
            
            //find nearest center
            for(k=0; k<clusters->secondary_dim; k++){ //run through centroids
                tmp_dist = euclidean_distance(data_in->dataset+i*data_in->leading_dim, clusters->dataset+k*clusters->leading_dim, data_in->leading_dim);
                if(tmp_dist<min_dist){
                    min_dist = tmp_dist;
                    tmp_index = k; //num of centroid
                }
            }

            data_in->members[i] = tmp_index; //num of centroid
            tempCentroids[ ( clusters->leading_dim + 1 ) * clusters->secondary_dim ] += min_dist; //last field
            tempCentroids[ tmp_index * ( clusters->leading_dim + 1 ) + clusters->leading_dim ]++; //last of every entry
            for(j=0; j< clusters->leading_dim; j++){
                tempCentroids[tmp_index * ( clusters->leading_dim + 1 ) + j] += data_in->dataset[i * data_in->leading_dim + j];
            }
        }
        MPI_Isend( tempCentroids, ( clusters->leading_dim + 1 ) * clusters->secondary_dim + 1, MPI_DOUBLE, 0, 3, MPI_COMM_WORLD, &req );
    }
    MPI_Send( data_in->members, data_in->secondary_dim, MPI_UNSIGNED, 0, 4, MPI_COMM_WORLD );
}
