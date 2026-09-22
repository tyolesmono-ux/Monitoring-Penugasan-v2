var PARENT_FOLDER_ID = "YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE";

function doGet(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  var action = e.parameter.action;
  
  if (action == 'getPegawai') {
    output.setContent(JSON.stringify(getPegawai()));
    return output;
  } else if (action == 'getLaporan') {
    var nama = e.parameter.nama;
    output.setContent(JSON.stringify(getLaporan(nama)));
    return output;
  } else if (action == 'updatePimpinan') { 
    var rowIndex = parseInt(e.parameter.row);
    var status = e.parameter.status;
    var catatan = e.parameter.catatan;
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("REKAP_LAPORAN");
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var colStatus = headers.indexOf("Status Tindak Lanjut") + 1;
    var colCatatan = headers.indexOf("Catatan Pimpinan") + 1;
    
    if (colStatus > 0 && status !== undefined) sheet.getRange(rowIndex, colStatus).setValue(status);
    if (colCatatan > 0 && catatan !== undefined) sheet.getRange(rowIndex, colCatatan).setValue(catatan);
    
    output.setContent(JSON.stringify({status: "success"}));
    return output;
  } else {
    output.setContent(JSON.stringify({status: "error", message: "Action tidak ditemukan"}));
    return output;
  }
}

function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("REKAP_LAPORAN");
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Tangani operasi updateLaporan
    if (data.action === "updateLaporan" && data.rowIndex) {
      var rowIndex = parseInt(data.rowIndex);
      if (rowIndex < 2 || rowIndex > sheet.getLastRow()) {
        output.setContent(JSON.stringify({status: "error", message: "Index baris tidak valid"}));
        return output;
      }
      
      // Simpan file Dokumentasi baru
      var docsUrls = [];
      if (data.dokumentasi && data.dokumentasi.length > 0) {
        docsUrls = saveFilesToDrive(data.dokumentasi, "Dokumentasi Kegiatan (File responses)");
      }
      
      // Simpan file Materi baru
      var materiUrls = [];
      if (data.materi && data.materi.length > 0) {
        materiUrls = saveFilesToDrive(data.materi, "Materi (Jika Ada) (File responses)");
      }
      
      // Dapatkan URL dokumentasi dan materi yang sudah ada
      var existingDokUrls = data.existingDokUrls || [];
      var existingMateriUrls = data.existingMateriUrls || [];
      var allDocsUrls = existingDokUrls.concat(docsUrls);
      var allMateriUrls = existingMateriUrls.concat(materiUrls);
      
      var rowRange = sheet.getRange(rowIndex, 1, 1, headers.length);
      var rowValues = rowRange.getValues()[0];
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        if (h == "Nama Pegawai") rowValues[i] = data.namaPegawai;
        else if (h == "Bidang") rowValues[i] = data.bidang;
        else if (h == "Jenis Penugasan") rowValues[i] = data.jenisPenugasan;
        else if (h == "Tanggal Kegiatan") {
          var parts = data.tanggalKegiatan.split("-");
          rowValues[i] = parts[2] + "/" + parts[1] + "/" + parts[0];
        }
        else if (h == "Nama Kegiatan") rowValues[i] = data.namaKegiatan;
        else if (h == "Tempat Kegiatan") rowValues[i] = data.tempatKegiatan;
        else if (h == "Penyelenggara Kegiatan") rowValues[i] = data.penyelenggara;
        else if (h == "Tamu Undangan yang Hadir") rowValues[i] = data.tamuUndangan || "";
        else if (h == "Catatan Hasil Kegiatan") rowValues[i] = data.catatanHasil || "";
        else if (h == "Dokumentasi Kegiatan") rowValues[i] = allDocsUrls.join("\n");
        else if (h == "Materi (Jika Ada)") rowValues[i] = allMateriUrls.join("\n");
        // Status Tindak Lanjut & Catatan Pimpinan SENGAJA TIDAK DIUBAH
      }
      rowRange.setValues([rowValues]);
      
      output.setContent(JSON.stringify({status: "success", message: "Laporan berhasil diperbarui"}));
      return output;
    }
    
    // Simpan file Dokumentasi
    var docsUrls = [];
    if (data.dokumentasi && data.dokumentasi.length > 0) {
      docsUrls = saveFilesToDrive(data.dokumentasi, "Dokumentasi Kegiatan (File responses)");
    }
    
    // Simpan file Materi
    var materiUrls = [];
    if (data.materi && data.materi.length > 0) {
      materiUrls = saveFilesToDrive(data.materi, "Materi (Jika Ada) (File responses)");
    }
    
    var row = [];
    for (var i = 0; i < headers.length; i++) {
       var h = headers[i];
       if (h == "Nama Pegawai") row.push(data.namaPegawai);
       else if (h == "Bidang") row.push(data.bidang);
       else if (h == "Jenis Penugasan") row.push(data.jenisPenugasan);
       else if (h == "Tanggal Kegiatan") {
         // Format tanggal dari YYYY-MM-DD ke DD/MM/YYYY
         var parts = data.tanggalKegiatan.split("-");
         row.push(parts[2] + "/" + parts[1] + "/" + parts[0]);
       }
       else if (h == "Nama Kegiatan") row.push(data.namaKegiatan);
       else if (h == "Tempat Kegiatan") row.push(data.tempatKegiatan);
       else if (h == "Penyelenggara Kegiatan") row.push(data.penyelenggara);
       else if (h == "Tamu Undangan yang Hadir") row.push(data.tamuUndangan);
       else if (h == "Catatan Hasil Kegiatan") row.push(data.catatanHasil);
       else if (h == "Dokumentasi Kegiatan") row.push(docsUrls.join("\n"));
       else if (h == "Materi (Jika Ada)") row.push(materiUrls.join("\n"));
       else if (h == "Status Tindak Lanjut") row.push("Untuk Diketahui");
       else if (h == "Catatan Pimpinan") row.push("");
       else row.push("");
    }
    
    sheet.appendRow(row);
    output.setContent(JSON.stringify({status: "success"}));
  } catch (error) {
    output.setContent(JSON.stringify({status: "error", message: error.toString()}));
  }
  return output;
}

function saveFilesToDrive(filesArray, folderName) {
  var parent = DriveApp.getFolderById(PARENT_FOLDER_ID);
  var folders = parent.getFoldersByName(folderName);
  var targetFolder = folders.hasNext() ? folders.next() : parent.createFolder(folderName);
  
  var urls = [];
  filesArray.forEach(function(f) {
    if (f.base64 && f.name) {
      var blob = Utilities.newBlob(Utilities.base64Decode(f.base64), f.mime, f.name);
      var file = targetFolder.createFile(blob);
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (err) {
        // Fallback jika Google Workspace melarang sharing publik langsung
      }
      urls.push(file.getUrl());
    }
  });
  return urls;
}

function getPegawai() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DATA_PEGAWAI");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var result = [];
  
  for(var i=1; i<data.length; i++) {
    var obj = {};
    for(var j=0; j<headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    if(obj[headers[0]] !== "") {
      result.push(obj);
    }
  }
  return {status: "success", data: result};
}

function getLaporan(namaPegawai) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("REKAP_LAPORAN");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var result = [];
  
  // Bersihkan nama pencarian agar tidak masalah spasi atau huruf besar/kecil
  var searchName = namaPegawai ? namaPegawai.toString().toLowerCase().trim() : "";
  
  for(var i=1; i<data.length; i++) {
    var obj = {};
    obj['Row_Index'] = i + 1; 
    
    for(var j=0; j<headers.length; j++) {
      if (data[i][j] instanceof Date) {
        var d = data[i][j];
        obj[headers[j]] = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy"); 
      } else {
        obj[headers[j]] = data[i][j];
      }
    }
    
    // Ambil nama dari baris ini dan bersihkan juga
    var rowName = obj['Nama Pegawai'] ? obj['Nama Pegawai'].toString().toLowerCase().trim() : "";
    
    if (searchName === "") {
      result.push(obj);
    } else if (rowName === searchName) {
      result.push(obj);
    }
  }
  
  result.reverse(); 
  return {status: "success", data: result};
}

function onFormSubmit(e) {
  try {
    var sheet = e.range.getSheet();
    if (sheet.getName() === "REKAP_LAPORAN") {
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var colStatus = headers.indexOf("Status Tindak Lanjut") + 1;
      var row = e.range.getRow();
      
      if (colStatus > 0) {
        sheet.getRange(row, colStatus).setValue("Untuk Diketahui");
      }
    }
  } catch (error) {
  }
}