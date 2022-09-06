//language TypeScript
/*
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: filebeat
  namespace: monitoring
  labels:
    k8s-app: filebeat
spec:
  selector:
    matchLabels:
      k8s-app: filebeat
  template:
    metadata:
      labels:
        k8s-app: filebeat
    spec:
      serviceAccountName: filebeat
      terminationGracePeriodSeconds: 30
      hostNetwork: true
      dnsPolicy: ClusterFirstWithHostNet
      containers:
      - name: filebeat
        image: docker.elastic.co/beats/filebeat:7.13.0
        args: [
          "-c", "/etc/filebeat.yml",
          "-e",
        ]
        env:
        - name: ELASTICSEARCH_HOST
          value: elasticsearch
        - name: ELASTICSEARCH_PORT
          value: "9200"
        - name: ELASTICSEARCH_USERNAME
          value: elastic
        - name: ELASTICSEARCH_PASSWORD
          value: changeme
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        securityContext:
          runAsUser: 0
          # If using Red Hat OpenShift uncomment this:
          #privileged: true
        resources:
          limits:
            memory: 200Mi
          requests:
            cpu: 100m
            memory: 100Mi
        volumeMounts:
        - name: config
          mountPath: /etc/filebeat.yml
          readOnly: true
          subPath: filebeat.yml
        - name: data
          mountPath: /usr/share/filebeat/data
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        - name: varlog
          mountPath: /var/log
          readOnly: true
      volumes:
      - name: config
        configMap:
          defaultMode: 0640
          name: filebeat-config
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
      - name: varlog
        hostPath:
          path: /var/log
      # data folder stores a registry of read status for all files, so we don't send everything again on a Filebeat pod restart
      - name: data
        hostPath:
          # When filebeat runs as non-root user, this directory needs to be writable by group (g+w).
          path: /var/lib/filebeat-data
          type: DirectoryOrCreate
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: filebeat
subjects:
- kind: ServiceAccount
  name: filebeat
  namespace: monitoring
roleRef:
  kind: ClusterRole
  name: filebeat
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: filebeat
  labels:
    k8s-app: filebeat
rules:
- apiGroups: [""] # "" indicates the core API group
  resources:
  - namespaces
  - pods
  - nodes
  verbs:
  - get
  - watch
  - list
- apiGroups: ["apps"]
  resources:
    - replicasets
  verbs: ["get", "list", "watch"]
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: filebeat
  namespace: monitoring
  labels:
    k8s-app: filebeat
 */

import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";
const config = new pulumi.Config();


// delivery options: elastic, logstash
export const delivery = config.require("delivery");


const appLabels = { app: "filebeat" };
const filebeatNameConfig = "filebeat-" + delivery + ".yml";

const configMap = new k8s.core.v1.ConfigMap("filebeat-config", {
    metadata: {
        name: "filebeat-config",
        namespace: "monitoring",
    },
    data: {
        "filebeat.yml": fs.readFileSync( filebeatNameConfig ).toString(),
    },
});

// Create a ServiceAccount for the DaemonSet
const serviceAccount = new k8s.core.v1.ServiceAccount("filebeat", {
    metadata: {
        name: "filebeat",
        namespace: "monitoring",
        labels: appLabels,

    },
});

// Create a ClusterRoleBinding for the ServiceAccount
const clusterRoleBinding = new k8s.rbac.v1.ClusterRoleBinding("filebeat", {
    metadata: {
        name: "filebeat",
    },
    subjects: [{
        kind: "ServiceAccount",
        name: serviceAccount.metadata.name,
        namespace: serviceAccount.metadata.namespace,
    }],
    roleRef: {
        kind: "ClusterRole",
        name: "filebeat",
        apiGroup: "rbac.authorization.k8s.io",
    },
});

// Create a ClusterRole for the ServiceAccount
const clusterRole = new k8s.rbac.v1.ClusterRole("filebeat", {
    metadata: {
        name: "filebeat",
        labels: appLabels,

    },
    rules: [
        {
            apiGroups: [""],
            resources: ["namespaces", "pods", "nodes"],
            verbs: ["get", "watch", "list"],
        },
        {
            apiGroups: ["apps"],
            resources: ["replicasets"],
            verbs: ["get", "list", "watch"],
        },
    ],
});

// Create a DaemonSet
const filebeat = new k8s.apps.v1.DaemonSet("filebeat", {
    metadata: {
        name: "filebeat",
        namespace: "monitoring",
        labels: appLabels,
    },
    spec: {
        selector: { matchLabels: appLabels },
        template: {
            metadata: {
                labels: appLabels,
            },
            spec: {
                serviceAccountName: serviceAccount.metadata.name,
                terminationGracePeriodSeconds: 30,
                hostNetwork: true,
                dnsPolicy: "ClusterFirstWithHostNet",
                containers: [
                    {
                        name: "filebeat",
                        image: "docker.elastic.co/beats/filebeat:7.13.0",
                        args: [
                            "-c", "/etc/filebeat.yml",
                            "-e",
                        ],
                        env: [
                            {
                                name: "ELASTICSEARCH_HOST",
                                value: "elasticsearch.monitoring",
                            },
                            {
                                name: "ELASTICSEARCH_PORT",
                                value: "9200",
                            },
                            {
                                name: "ELASTICSEARCH_USERNAME",
                                value: "elastic",
                            },
                            {
                                name: "ELASTICSEARCH_PASSWORD",
                                value: "changeme",
                            },
                            {
                                name: "NODE_NAME",
                                valueFrom: {
                                    fieldRef: {
                                        fieldPath: "spec.nodeName",
                                    },
                                },
                            },
                        ],
                        securityContext: {
                            runAsUser: 0,
                            privileged: true,
                        },
                        resources: {
                            limits: {
                                memory: "200Mi",
                                cpu: "100m",
                            },
                            requests: {
                                memory: "200Mi",
                                cpu: "100m",
                            },
                        },
                        volumeMounts: [
                            {
                                name: "config",
                                mountPath: "/etc/filebeat.yml",
                                subPath: "filebeat.yml",
                                readOnly: true,
                            },
                            {
                                name: "varlibdockercontainers",
                                mountPath: "/var/lib/docker/containers",
                                readOnly: true,
                                subPath: "",
                            },
                            {
                                name: "varlog",
                                mountPath: "/var/log",
                                readOnly: true,
                                subPath: "",
                            },
                            {
                                name: "data",
                                mountPath: "/usr/share/filebeat/data",
                                readOnly: false,
                                subPath: "",
                            },
                        ],
                    },
                ],
                volumes: [
                    {
                        name: "config",
                        configMap: {
                            name: configMap.metadata.name,
                            defaultMode: 420,
                        },
                    },
                    {
                        name: "varlibdockercontainers",
                        hostPath: {
                            path: "/var/lib/docker/containers",
                            type: "DirectoryOrCreate",
                        },
                    },
                    {
                        name: "varlog",
                        hostPath: {
                            path: "/var/log",
                            type: "DirectoryOrCreate",
                        },
                    },
                    {
                        name: "data",
                        hostPath: {
                            path: "/usr/share/filebeat/data",
                            type: "DirectoryOrCreate",
                        },
                    },
                ],
            },
        },

    },
});


export const name = filebeat.metadata.name;
