import fs = require('fs')
import MP4Parser from 'mp4parser'

class Sample {
    Size: number;
    DT: number;
    CT: number;
    Type: string;
    Chunk: number;
    Position: number;
    Description: number;
}

class Context {
    ChunkOffset: Array<number> = [];
    SampleToChunk: Array<{ FirstChunk: number, SamplesPerChunk: number, SampleDescriptionIndex: number }> = [];
    SampleSize: Array<number> = [];
    Dt: Array<{ SampleCount: number, SampleDelta: number }> = [];
    Ct: Array<{ SampleCount: number, SampleOffset: number }> = [];
    SyncSample: Array<number> = [];

    public getSamples(): Array<Sample> {
        let samples = [];
        let i_SampleToChunk = 0;
        let c_SampleToChunk = this.SampleToChunk[i_SampleToChunk].SamplesPerChunk;
        let chunk = this.SampleToChunk[i_SampleToChunk].FirstChunk;
        let curSampleOffset = this.ChunkOffset[chunk - 1];
        let i_dt = 0;
        let c_dt = this.Dt[i_dt].SampleCount;
        let i_ct = 0;
        let c_ct = this.Ct[i_ct].SampleCount;
        let curSampleDt = 0;
        let i_SyncSample = 0;
        for (var i = 0; i < this.SampleSize.length; i++) {
            var sample = new Sample();
            sample.Size = this.SampleSize[i];
            if (c_SampleToChunk == 0) {
                c_SampleToChunk = this.SampleToChunk[++i_SampleToChunk].SamplesPerChunk;
                chunk++;
                curSampleOffset = this.ChunkOffset[chunk - 1];
            }
            c_SampleToChunk--;
            sample.Chunk = chunk;
            sample.Description = this.SampleToChunk[i_SampleToChunk].SampleDescriptionIndex;
            sample.Position = curSampleOffset;
            curSampleOffset += sample.Size;

            if (c_dt == 0) {
                c_dt = this.Dt[++i_dt].SampleCount;
            }
            c_dt--;
            if (c_ct == 0) {
                c_ct = this.Ct[++i_ct].SampleCount;
            }
            c_ct--;
            sample.DT = curSampleDt;
            curSampleDt += this.Dt[i_dt].SampleDelta;
            sample.CT = sample.DT + this.Ct[i_ct].SampleOffset;

            if (i + 1 == this.SyncSample[i_SyncSample]) {
                sample.Type = 'I';
                if (i_SyncSample < this.SyncSample.length)
                    i_SyncSample++;
            }
            // else if (sample.DT < sample.CT) {
            //     sample.Type = 'P';
            // }
            // else {
            //     sample.Type = 'B';
            // }
            samples.push(sample);
        }
        return samples;
    }
}

let parser = new MP4Parser(fs.createReadStream('resource/30s.mp4'));
let context = new Context();
parser.on('atom', atom => {
    var seq = "00" + atom._seq;
    seq = seq.substring(seq.length - 3, seq.length);
    console.log(`${seq}. |${new Array(atom._level * 3).join('-')}${atom.type}(size:${atom.size}, pos:${atom._pos})`);
});

function init() {
    parser.on('data_stco', data => {
        let atom = data as Buffer;
        let offset = 12;
        let entry_count = atom.readUInt32BE(offset);
        offset += 4;
        for (var i = 0; i < entry_count; i++) {
            let chunk_offset = atom.readUInt32BE(offset);
            offset += 4;
            //console.log(`chunk_offset ${chunk_offset}`);
            context.ChunkOffset.push(chunk_offset);
        }
    });
    parser.on('data_stsc', data => {
        let atom = data as Buffer;
        let offset = 12;
        let entry_count = atom.readUInt32BE(offset);
        offset += 4;
        for (var i = 0; i < entry_count; i++) {
            let first_chunk = atom.readUInt32BE(offset);
            offset += 4;
            let samples_per_chunk = atom.readUInt32BE(offset);
            offset += 4;
            let sample_description_index = atom.readUInt32BE(offset);
            offset += 4;
            // console.log(`first_chunk ${first_chunk}`);
            // console.log(`samples_per_chunk ${samples_per_chunk}`);
            // console.log(`sample_description_index ${sample_description_index}`);
            context.SampleToChunk.push({
                FirstChunk: first_chunk,
                SamplesPerChunk: samples_per_chunk,
                SampleDescriptionIndex: sample_description_index
            });
        }
    });
    parser.on('data_stsz', data => {
        let atom = data as Buffer;
        let offset = 12;
        let sample_size = atom.readUInt32BE(offset);
        offset += 4;
        let sample_count = atom.readUInt32BE(offset);
        offset += 4;
        let counter = 1;
        if (sample_size == 0)
            for (var i = 0; i < sample_count; i++) {
                let entry_size = atom.readUInt32BE(offset);
                offset += 4;
                context.SampleSize.push(entry_size);
            }
    });
    parser.on('data_stts', data => {
        let atom = data as Buffer;
        let offset = 12;
        let entry_count = atom.readUInt32BE(offset);
        offset += 4;
        for (var i = 0; i < entry_count; i++) {
            let sample_count = atom.readUInt32BE(offset);
            offset += 4;
            let sample_delta = atom.readUInt32BE(offset);
            offset += 4;
            context.Dt.push({
                SampleCount: sample_count,
                SampleDelta: sample_delta
            });
            // console.log(`sample_count ${sample_count}`);
            // console.log(`sample_delta ${sample_delta}`);
        }
    });
    parser.on('data_ctts', data => {
        let atom = data as Buffer;
        let offset = 12;
        let entry_count = atom.readUInt32BE(offset);
        offset += 4;
        for (var i = 0; i < entry_count; i++) {
            let sample_count = atom.readUInt32BE(offset);
            offset += 4;
            let sample_offset = atom.readUInt32BE(offset);
            offset += 4;
            context.Ct.push({
                SampleCount: sample_count,
                SampleOffset: sample_offset
            });
            // console.log(`sample_count ${sample_count}`);
            // console.log(`sample_offset ${sample_offset}`);
        }
    });
    parser.on('data_stss', data => {
        let atom = data as Buffer;
        let offset = 12;
        let entry_count = atom.readUInt32BE(offset);
        offset += 4;
        for (var i = 0; i < entry_count; i++) {
            let sample_number = atom.readUInt32BE(offset);
            offset += 4;
            context.SyncSample.push(sample_number);
            //console.log(`sample_number ${sample_number}`);
        }
    });
}

init();
parser.start();

setTimeout(function () {
    var samples = context.getSamples();
    var counter = 1;
    samples.forEach(s => {
        console.log(`${counter++}:${s.Position}, ${s.Size}, ${s.DT}, ${s.CT},${s.Chunk}`)
    });
    //console.log(samples);
}, 2000);

function splitVideo(start:number, end:number){
    
}