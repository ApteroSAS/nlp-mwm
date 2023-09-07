import sys
import os
import json
    
    
f = open('docker.json',)
data = json.load(f)
dockerImage = data['image']
registry = data['registry']

c = os.system
os.chdir("..")
print(os.getcwd())
if(sys.argv[1] == "build"):
    os.system("docker build -t "+dockerImage+" .")
 
elif(sys.argv[1] == "build_no_cache"):
    os.system("docker build --no-cache --progress=plain -t "+dockerImage+" .")

elif(sys.argv[1] == "publish"):
    import json

    try:
        version = sys.argv[2]
    except:
        try:
            f = open('version.json',)
            data = json.load(f)
            if data['version']:
                version = data['version']
            else:
                raise Exception("no version found in file")
        except:
            f = open('package.json',)
            data = json.load(f)
            if data['version']:
                version = data['version']
            else:
                version = "latest"

    c("docker build -t "+dockerImage+" .") 
    c("docker login")
    c("docker tag "+dockerImage+":latest "+registry+"/"+dockerImage+":latest")
    c("docker push "+registry+"/"+dockerImage+":latest")

    c("docker tag "+dockerImage+":latest "+registry+"/"+dockerImage+":"+version)
    c("docker push "+registry+"/"+dockerImage+":"+version)
    print("tag version :"+version)

else:
    print("invalid usage")
