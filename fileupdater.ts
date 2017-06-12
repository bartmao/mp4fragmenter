import fs = require('fs');
import path = require('path');

export default class FileUpdater{
    updateList:Array<{start:number, end:number, obj:object}>;
    tmp_fileName:string;
    rs:fs.ReadStream;
    ws:fs.WriteStream;
    constructor(public fileName:string){
        var f = path.parse(fileName);
        this.tmp_fileName = path.join(f.dir, f.name, '_1.', f.ext); 
        this.rs = fs.createReadStream(fileName);
        this.ws = fs.createWriteStream(this.tmp_fileName); 
        this.updateList = []; 
}

    update(start:number, end:number, obj:object){
        this.updateList.push()
    }

    save(){

    }
}