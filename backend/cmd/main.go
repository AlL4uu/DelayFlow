package main

import (
	"context"
	"demo/internal/platform"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	srv, err := platform.NewServer()
	if err != nil {
		log.Fatalf("new server: %v", err)
	}

	go func() {
		log.Printf("server start on :8080")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen is error %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGALRM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Shutdown is error %s\n", err)
	}

	log.Println("server start success")

}
