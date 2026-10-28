package platform

import (
	"demo/internal/config"
	"flag"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

func NewServer() (*http.Server, error) {
	cfgPath := flag.String("f", "etc/config.yaml", "config file path")
	flag.Parse()

	if err := config.Init(*cfgPath); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}

	r := gin.Default()
	r.GET("/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"message": "ok",
		})
	})

	return &http.Server{
		Addr:    ":" + config.Conf.Server.Port,
		Handler: r,
	}, nil
}
