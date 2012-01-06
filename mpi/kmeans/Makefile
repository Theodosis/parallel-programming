CC = mpicc
FLG = -O4
NAME = kmeansTest

all: kmeansTest.o kmeans.o cluster.h

	$(CC) $(FLG) kmeansTest.o kmeans.o -o $(NAME)

kmeansTest.o: kmeansTest.c kmeans.h

	$(CC) $(FLG) kmeansTest.c -c

kmeans.o: kmeans.c kmeans.h cluster.h

	$(CC) $(FLG) kmeans.c -c

clean:
	rm -f *.o *.out *.exe
	rm -f *.bin  
