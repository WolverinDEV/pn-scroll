#!/bin/bash

base_dir=$(pwd)
ssl_key_file="$base_dir/ssl_key.pem"
ssl_cert_file="$base_dir/ssl_cert.pem"

if command -v cygpath &> /dev/null; then
  echo "cygpath found. Transforming paths."
  ssl_key_file=$(cygpath -w "$ssl_key_file")
  ssl_cert_file=$(cygpath -w "$ssl_cert_file")
  # shellcheck disable=SC2034
  export MSYS_NO_PATHCONV=1
fi

if [ ! -f "$ssl_cert_file" ]; then
   subj="/C=DE/ST=Something/L=Nearby/O=self signed/OU=RequestProxy/CN=localhost/emailAddress=pn-scroll@did.science"
   openssl req -nodes -x509 -newkey rsa:4096 -keyout "$ssl_key_file" -out "$ssl_cert_file" -sha256 -days 3650 \
          -subj "$subj"
fi

webpack-cli && SSL_CERTIFICATE="$ssl_cert_file" SSL_KEY="$ssl_key_file" node ./dist/server.js
read -p "Press enter to continue"
