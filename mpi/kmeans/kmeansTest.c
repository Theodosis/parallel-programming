#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <sys/time.h>
#include "kmeans.h"
#include "cluster.h"
#include <mpi.h>
#include <float.h>
#include <math.h>

#define max_iterations 50

void error_message(){

char *help = "Error using kmeans: Three arguments required\n"
  "First: number of elements\n"
  "Second: number of attributes (dimensions)\n"
  "Third: numder of clusters\n";

  printf(help);

}

void random_initialization(data_struct *data_in){

  int i, j = 0;
  int n = data_in->leading_dim;
  int m = data_in->secondary_dim;
  double *tmp_dataset = data_in->dataset;
  unsigned int *tmp_Index = data_in->members;


  srand(time(NULL)); // generate different random numbers
  for(i=0; i<m; i++){
    tmp_Index[i] = 0;
    for(j=0; j<n; j++){
      tmp_dataset[i*n + j] = (double) rand() / RAND_MAX; 
    }
  }

}


void initialize_clusters(data_struct *data_in,data_struct *cluster_in){

  int i, j, pick = 0;
  int n = cluster_in->leading_dim;
  int m = cluster_in->secondary_dim;
  int Objects = data_in->secondary_dim;
  double *tmp_Centroids = cluster_in->dataset;
  double *tmp_dataset = data_in->dataset;
  unsigned int *tmp_Sizes = data_in->members;

  int step = Objects / m;

  /*randomly pick initial cluster centers*/
  for(i=0; i<m; i++){
    for(j=0; j<n; j++){
      tmp_Centroids[i*n + j] = tmp_dataset[pick * n + j];
    }
    pick += step; 
  }

}

void print(data_struct* data2print){

  int i, j = 0;
  int n = data2print->leading_dim;
  int m = data2print->secondary_dim;
  double *tmp_dataset = data2print->dataset;

  
  for(i=0; i<m; i++){
    for(j=0; j<n; j++){
      printf("%f ", tmp_dataset[i*n + j]);
    }
    printf("\n");
  }
  
}


void save(data_struct* data2save, char *filename1, char *filename2){

  int i, j = 0;
  FILE *outfile;
  int n = data2save->leading_dim;
  int m = data2save->secondary_dim;
  double *tmp_dataset = data2save->dataset;
  unsigned int *tmp_members = data2save->members;

  printf("Saving data to files: "); printf(filename1); printf(" and "); printf(filename2); printf("\n");

  /*===========Save to file 1===========*/
  if((outfile=fopen(filename1, "wb")) == NULL){
    printf("Can't open output file\n");
  }

  fwrite(tmp_dataset, sizeof(double), m*n, outfile);

  fclose(outfile);

  /*===========Save to file 2========*/

  if((outfile=fopen(filename2, "wb")) == NULL){
    printf("Can't open output file\n");
  }

  fwrite(tmp_members, sizeof(unsigned int), m, outfile);

  fclose(outfile);

}

void clean(data_struct* data1){

  free(data1->dataset);
  free(data1->members);
}


int main(int argc, char **argv){
  struct timeval first, second, lapsed, third, forth;
  struct timezone tzp;

  if(argc<4){
    error_message();
    return 0;
    //printf("Error using kmeans: Three arguments required\n");
  }

  int numObjects = atoi(argv[1]);
  int numAttributes = atoi(argv[2]);
  int numClusters = atoi(argv[3]);
  int i =0, total, rank ;

  char *file1_0 = "centroids.bin";
  char *file1_1 = "ClusterSize.bin";
  char *file2_0 = "dataset.bin";
  char *file2_1 = "Index.bin"; 

  data_struct data_in;
  data_struct clusters;


    MPI_Init( &argc, &argv );
    MPI_Comm_size( MPI_COMM_WORLD, &total );
    MPI_Comm_rank( MPI_COMM_WORLD, &rank );
    if( rank == 0 ){
      /*=======Memory Allocation=========*/
      data_in.leading_dim = numAttributes;
      data_in.secondary_dim = numObjects;
      data_in.dataset = (double*)malloc(numObjects*numAttributes*sizeof(double));
      data_in.members = (unsigned int*)malloc(numObjects*sizeof(unsigned int));

      clusters.leading_dim = numAttributes;
      clusters.secondary_dim = numClusters;
      clusters.dataset = (double*)malloc(numClusters*numAttributes*sizeof(double));
      clusters.members = (unsigned int*)malloc(numClusters*sizeof(unsigned int)); 


      /*=============initialize ==========*/
      random_initialization(&data_in);
      initialize_clusters(&data_in, &clusters);
      /*=================================*/

      gettimeofday(&first, &tzp);
      cluster(&data_in, &clusters, max_iterations);
      gettimeofday(&second, &tzp);


      if(first.tv_usec>second.tv_usec){
        second.tv_usec += 1000000;
        second.tv_sec--;
      }
      lapsed.tv_usec = second.tv_usec - first.tv_usec;
      lapsed.tv_sec = second.tv_sec - first.tv_sec;
      printf("Time elapsed: %d.%06dsec\n", lapsed.tv_sec, lapsed.tv_usec); 
      /*========save data============*/
      save(&clusters, file1_0, file1_1);
      save(&data_in, file2_0, file2_1);

      /*============clean memory===========*/
      clean(&data_in);
      clean(&clusters);
    }
    else{
        data_in.leading_dim = numAttributes;
        data_in.secondary_dim = (int) numObjects / total;
        data_in.dataset = (double*)malloc(numObjects / total * numAttributes*sizeof(double));
        data_in.members = (unsigned int*)malloc(numObjects / total * sizeof(unsigned int));

        clusters.leading_dim = numAttributes;
        clusters.secondary_dim = numClusters;
        clusters.dataset = (double*)malloc(numClusters*numAttributes*sizeof(double));
        clusters.members = (unsigned int*)malloc(numClusters*sizeof(unsigned int)); 
        
        
        newproc( &data_in, &clusters );
    }
    MPI_Finalize();
}
