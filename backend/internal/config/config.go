package config

import (
	"fmt"

	"github.com/spf13/viper"
)

var Conf Config

type Server struct {
	Port string `mapstructure:"port"`
}

type Mysql struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Database string `mapstructure:"database"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
}

type Config struct {
	Server Server `mapstructure:"server"`
	Mysql  Mysql  `mapstructure:"port"`
}

func Init(path string) error {
	viper.SetConfigFile(path)
	viper.SetConfigType("yaml")

	if err := viper.ReadInConfig(); err != nil {
		return fmt.Errorf("read config: %w", err)
	}
	if err := viper.Unmarshal(&Conf); err != nil {
		return fmt.Errorf("read config: %w", err)
	}
	return nil
}

func setDefaults() {
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("mysql.host", "127.0.0.1")
	viper.SetDefault("mysql.port", 3306)
	viper.SetDefault("mysql.database", "delayflow")
}

func (m Mysql) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		m.Username, m.Password, m.Host, m.Port, m.Database)
}
